ALTER TABLE content_versions ADD COLUMN title text CHECK(title IS NULL OR length(trim(title)) BETWEEN 1 AND 200);

CREATE OR REPLACE FUNCTION jkc_content_workflow(action text, payload jsonb, req text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=jkc_user(); dept uuid; cid uuid; vid uuid; aid uuid; c contents; v content_versions;
 a approvals; result jsonb; target_status content_state; decision approval_decision;
BEGIN
 SELECT department_id INTO dept FROM users WHERE id=actor AND is_active;
 IF actor IS NULL OR dept IS NULL THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
 IF action='create' THEN
  IF payload->>'kind' NOT IN ('DOCUMENT','ARTICLE') OR length(trim(payload->>'title')) NOT BETWEEN 1 AND 200
   OR jsonb_typeof(payload->'body')<>'object' THEN RAISE EXCEPTION 'JKC_INVALID'; END IF;
  IF payload->>'visibility'='COMPANY' AND (payload->>'kind'<>'DOCUMENT' OR NOT jkc_hr(dept,true)) THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
  IF payload->>'visibility' NOT IN ('COMPANY','DEPARTMENT') THEN RAISE EXCEPTION 'JKC_INVALID'; END IF;
  INSERT INTO contents(code,kind,title,creator_id,owner_department_id,visibility)
   VALUES('S1-'||gen_random_uuid(),payload->>'kind',trim(payload->>'title'),actor,dept,(payload->>'visibility')::visibility_level) RETURNING * INTO c;
  INSERT INTO content_versions(content_id,version_number,body,created_by,process_id,title)
   VALUES(c.id,1,payload->'body',actor,(payload->>'process_id')::uuid,trim(payload->>'title')) RETURNING * INTO v;
 ELSE
  cid:=(payload->>'content_id')::uuid;
  SELECT * INTO c FROM contents WHERE id=cid AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND OR c.kind NOT IN ('DOCUMENT','ARTICLE') OR NOT (c.creator_id=actor OR jkc_review(cid)) THEN RAISE EXCEPTION 'JKC_NOT_FOUND'; END IF;
  SELECT * INTO v FROM content_versions WHERE content_id=cid ORDER BY version_number DESC LIMIT 1 FOR UPDATE;
  IF v.id IS DISTINCT FROM (payload->>'version_id')::uuid OR v.revision IS DISTINCT FROM (payload->>'revision')::integer THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
  IF action IN ('save','submit','fork') AND c.creator_id<>actor THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
  IF action='fork' THEN
   IF v.status NOT IN ('APPROVED','CHANGES_REQUESTED','REJECTED') THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
   INSERT INTO content_versions(content_id,version_number,body,created_by,process_id,title)
    VALUES(cid,v.version_number+1,v.body,actor,v.process_id,coalesce(v.title,c.title)) RETURNING * INTO v;
  ELSIF action='save' THEN
   IF v.status<>'DRAFT' OR jsonb_typeof(payload->'body')<>'object' THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
   UPDATE content_versions SET body=payload->'body',title=coalesce(payload->>'title',title),process_id=(payload->>'process_id')::uuid,revision=revision+1 WHERE id=v.id RETURNING * INTO v;
  ELSIF action='submit' THEN
   IF v.status<>'DRAFT' OR (c.kind='ARTICLE' AND v.process_id IS NULL) THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
   UPDATE content_versions SET status='PENDING',revision=revision+1 WHERE id=v.id RETURNING * INTO v;
   INSERT INTO approvals(version_id,assigned_department_id) VALUES(v.id,c.owner_department_id);
  ELSIF action IN ('approve','request-changes','reject') THEN
   IF NOT jkc_review(cid) THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
   SELECT * INTO a FROM approvals WHERE version_id=v.id FOR UPDATE;
   IF NOT FOUND OR a.status<>'PENDING' OR v.status<>'PENDING' OR (a.assigned_user_id IS NOT NULL AND a.assigned_user_id<>actor) THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
   IF action<>'approve' AND length(trim(coalesce(payload->>'remark','')))=0 THEN RAISE EXCEPTION 'JKC_INVALID'; END IF;
   target_status:=CASE action WHEN 'approve' THEN 'APPROVED'::content_state WHEN 'reject' THEN 'REJECTED'::content_state ELSE 'CHANGES_REQUESTED'::content_state END;
   decision:=CASE action WHEN 'approve' THEN 'APPROVE'::approval_decision WHEN 'reject' THEN 'REJECT'::approval_decision ELSE 'REQUEST_CHANGES'::approval_decision END;
   UPDATE content_versions SET status=target_status,revision=revision+1,
    approved_by=CASE WHEN target_status='APPROVED' THEN actor END,approved_at=CASE WHEN target_status='APPROVED' THEN now() END
    WHERE id=v.id RETURNING * INTO v;
   UPDATE approvals SET status=target_status::text,decided_by=actor,decided_at=now(),remark=payload->>'remark' WHERE id=a.id;
   INSERT INTO approval_events(approval_id,actor_id,decision,remark) VALUES(a.id,actor,decision,payload->>'remark');
   IF target_status='APPROVED' THEN UPDATE contents SET current_published_version_id=v.id WHERE id=cid; END IF;
  ELSE RAISE EXCEPTION 'JKC_INVALID'; END IF;
 END IF;
 INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,new_data,request_id)
  VALUES(actor,'CONTENT_'||upper(action),'content_version',v.id,jsonb_build_object('revision',v.revision,'status',v.status),req);
 RETURN jsonb_build_object('id',c.id,'version_id',v.id,'version_number',v.version_number,'revision',v.revision,'status',v.status);
END $$;

CREATE OR REPLACE FUNCTION jkc_content_workspace() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC),'[]') FROM (
 SELECT c.id,coalesce(v.title,c.title) AS title,c.kind,c.visibility,c.creator_id,c.owner_department_id,v.id AS version_id,v.version_number,v.revision,v.status,v.body,v.process_id,v.created_at,
  (c.creator_id=jkc_user()) AS can_edit,jkc_review(c.id) AS can_review,
  (SELECT remark FROM approvals WHERE version_id=v.id) AS remark
 FROM contents c JOIN content_versions v ON v.content_id=c.id
 WHERE c.archived_at IS NULL AND c.kind IN ('DOCUMENT','ARTICLE') AND
 (c.creator_id=jkc_user() OR (jkc_review(c.id) AND v.status='PENDING'))
 ) t
$$;

CREATE OR REPLACE FUNCTION jkc_reading_manage(action text,payload jsonb,req text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=jkc_user(); c contents; v content_versions; target users; member uuid; targets uuid[]; inserted uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND is_active) THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
 IF action='list' THEN
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC),'[]') FROM (
   SELECT a.id,a.user_id,u.full_name,u.department_id,doc.id AS content_id,coalesce(ver.title,doc.title) AS title,ver.id AS version_id,ver.version_number,a.due_at,a.created_at,k.acknowledged_at,
    doc.current_published_version_id=ver.id AS is_current,
    CASE WHEN k.acknowledged_at IS NOT NULL THEN 'READ' WHEN a.due_at<now() THEN 'OVERDUE' ELSE 'UNREAD' END AS status
   FROM reading_assignments a JOIN users u ON u.id=a.user_id JOIN content_versions ver ON ver.id=a.version_id
   JOIN contents doc ON doc.id=ver.content_id LEFT JOIN reading_acks k ON k.assignment_id=a.id
   WHERE (jkc_head(u.department_id) OR jkc_hr(u.department_id)) AND jkc_acl_for(doc.id,actor)
  ) t);
 END IF;
 IF action<>'assign' THEN RAISE EXCEPTION 'JKC_INVALID'; END IF;
 SELECT * INTO c FROM contents WHERE id=(payload->>'content_id')::uuid AND kind='DOCUMENT' AND jkc_acl_for(id,actor) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'JKC_NOT_FOUND'; END IF;
 SELECT * INTO v FROM content_versions WHERE id=c.current_published_version_id;
 IF v.id IS NULL OR v.id IS DISTINCT FROM (payload->>'version_id')::uuid OR v.status<>'APPROVED' THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
 IF (payload->>'department_id') IS NOT NULL THEN
  IF NOT (jkc_head((payload->>'department_id')::uuid) OR jkc_hr((payload->>'department_id')::uuid)) THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
  SELECT array_agg(id) INTO targets FROM users WHERE is_active AND department_id=(payload->>'department_id')::uuid;
 ELSE targets:=ARRAY[(payload->>'user_id')::uuid]; END IF;
 IF coalesce(cardinality(targets),0)=0 OR targets[1] IS NULL THEN RAISE EXCEPTION 'JKC_INVALID'; END IF;
 FOREACH member IN ARRAY targets LOOP
  SELECT * INTO target FROM users WHERE id=member AND is_active;
  IF NOT FOUND OR NOT (jkc_head(target.department_id) OR jkc_hr(target.department_id)) OR NOT jkc_acl_for(c.id,member) THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
  INSERT INTO reading_assignments(user_id,version_id,due_at) VALUES(member,v.id,(payload->>'due_at')::timestamptz)
   ON CONFLICT DO NOTHING RETURNING id INTO inserted;
  IF inserted IS NOT NULL THEN INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,request_id) VALUES(actor,'READ_ASSIGNED','reading_assignment',inserted,req); END IF;
 END LOOP;
 RETURN jsonb_build_object('message','Đã giao đọc đúng phiên bản.');
END $$;

CREATE OR REPLACE FUNCTION jkc_incident_workflow(action text,payload jsonb,req text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=jkc_user(); dept uuid; i incidents; s incident_solutions; oid uuid; result jsonb;
BEGIN
 SELECT department_id INTO dept FROM users WHERE id=actor AND is_active;
 IF actor IS NULL OR dept IS NULL THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
 IF action='list' THEN
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC),'[]') FROM (
   SELECT rec.*,(rec.reporter_id=actor) AS can_edit,(jkc_head(rec.owner_department_id) AND rec.reporter_id<>actor) AS can_verify,
   coalesce((SELECT jsonb_agg(to_jsonb(sol) ORDER BY sol.id) FROM incident_solutions sol WHERE sol.incident_id=rec.id),'[]') AS solutions,
   coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.occurred_at DESC) FROM incident_occurrences o WHERE o.incident_id=rec.id),'[]') AS occurrences
   FROM incidents rec WHERE jkc_incident_read(rec.id)
  ) t);
 END IF;
 IF action='create' THEN
  INSERT INTO incidents(code,title,process_id,reporter_id,owner_department_id,severity,symptoms,conditions,occurred_at)
   VALUES('INC-'||gen_random_uuid(),payload->>'title',(payload->>'process_id')::uuid,actor,dept,payload->>'severity',payload->>'symptoms',payload->'conditions',(payload->>'occurred_at')::timestamptz) RETURNING * INTO i;
 ELSE
  SELECT * INTO i FROM incidents WHERE id=(payload->>'incident_id')::uuid AND jkc_incident_read(id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'JKC_NOT_FOUND'; END IF;
  IF action='update' THEN
   IF i.reporter_id<>actor THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
   IF i.revision IS DISTINCT FROM (payload->>'revision')::integer OR EXISTS(SELECT 1 FROM incident_solutions WHERE incident_id=i.id AND status='VERIFIED') THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
   UPDATE incidents SET title=payload->>'title',process_id=(payload->>'process_id')::uuid,severity=payload->>'severity',symptoms=payload->>'symptoms',conditions=payload->'conditions',revision=revision+1 WHERE id=i.id RETURNING * INTO i;
  ELSIF action='propose' THEN
   INSERT INTO incident_solutions(incident_id,proposed_by,cause_hypothesis,steps,outcome)
    VALUES(i.id,actor,payload->>'cause',payload->'steps',payload->>'outcome') RETURNING * INTO s;
  ELSIF action='verify' THEN
   SELECT * INTO s FROM incident_solutions WHERE id=(payload->>'solution_id')::uuid AND incident_id=i.id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'JKC_NOT_FOUND'; END IF;
   IF NOT jkc_head(i.owner_department_id) OR actor IN (i.reporter_id,s.proposed_by) THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
   IF s.status<>'PROPOSED' OR s.revision IS DISTINCT FROM (payload->>'revision')::integer OR i.revision IS DISTINCT FROM (payload->>'incident_revision')::integer THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
   IF length(trim(coalesce(payload->>'verified_cause','')))=0 OR length(trim(coalesce(s.outcome,'')))=0 OR jsonb_array_length(s.steps)=0 THEN RAISE EXCEPTION 'JKC_INVALID'; END IF;
   UPDATE incident_solutions SET status='VERIFIED',verified_cause=payload->>'verified_cause',verified_by=actor,verified_at=now(),revision=revision+1 WHERE id=s.id RETURNING * INTO s;
  ELSIF action='occur' THEN
   IF payload->>'request_key' IS NULL THEN RAISE EXCEPTION 'JKC_INVALID'; END IF;
   INSERT INTO incident_occurrences(incident_id,reported_by,request_key,note,outcome,occurred_at)
    VALUES(i.id,actor,(payload->>'request_key')::uuid,payload->>'note',payload->>'outcome',coalesce((payload->>'occurred_at')::timestamptz,now()))
    ON CONFLICT DO NOTHING RETURNING id INTO oid;
   IF oid IS NULL THEN
    SELECT id INTO oid FROM incident_occurrences WHERE incident_id=i.id AND reported_by=actor AND request_key=(payload->>'request_key')::uuid;
    RETURN jsonb_build_object('id',i.id,'occurrence_id',oid);
   END IF;
  ELSE RAISE EXCEPTION 'JKC_INVALID'; END IF;
 END IF;
 INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,request_id) VALUES(actor,'INCIDENT_'||upper(action),'incident',i.id,req);
 RETURN jsonb_build_object('id',i.id,'revision',i.revision,'solution_id',s.id,'solution_revision',s.revision,'occurrence_id',oid);
END $$;
