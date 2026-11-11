ALTER TABLE incidents ADD COLUMN owner_department_id uuid REFERENCES departments(id);
UPDATE incidents i SET owner_department_id=u.department_id FROM users u WHERE u.id=i.reporter_id;
ALTER TABLE incidents ALTER COLUMN owner_department_id SET NOT NULL;
ALTER TABLE incidents ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE incident_solutions ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE incident_occurrences ADD COLUMN request_key uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE incident_occurrences ADD CONSTRAINT occurrence_dedup UNIQUE(incident_id,reported_by,request_key);
CREATE FUNCTION jkc_incident_read(iid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM incidents i JOIN users u ON u.id=jkc_user() AND u.is_active
 WHERE i.id=iid AND (i.reporter_id=u.id OR i.owner_department_id=u.department_id))
$$;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY incident_read ON incidents FOR SELECT USING(jkc_incident_read(id));
CREATE POLICY solution_read ON incident_solutions FOR SELECT USING(jkc_incident_read(incident_id));
CREATE POLICY occurrence_read ON incident_occurrences FOR SELECT USING(jkc_incident_read(incident_id));
CREATE TRIGGER occurrence_history BEFORE UPDATE OR DELETE ON incident_occurrences FOR EACH ROW EXECUTE FUNCTION jkc_fixed_history();
CREATE FUNCTION jkc_frozen_solution() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.status='VERIFIED' THEN RAISE EXCEPTION 'Verified solution is immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER frozen_solution BEFORE UPDATE OR DELETE ON incident_solutions FOR EACH ROW EXECUTE FUNCTION jkc_frozen_solution();

CREATE FUNCTION jkc_incident_workflow(action text,payload jsonb,req text) RETURNS jsonb
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
   IF s.status<>'PROPOSED' OR s.revision IS DISTINCT FROM (payload->>'revision')::integer THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
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
REVOKE ALL ON FUNCTION jkc_incident_read(uuid),jkc_incident_workflow(text,jsonb,text) FROM PUBLIC;
