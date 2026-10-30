ALTER TABLE course_versions ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE course_versions ADD COLUMN approved_by uuid REFERENCES users(id);
ALTER TABLE course_versions ADD COLUMN approved_at timestamptz;

CREATE FUNCTION jkc_course_workspace() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.title,t.version_number DESC),'[]') FROM (
 SELECT c.id,c.title,c.created_by,c.owner_department_id,v.id AS version_id,v.version_number,v.revision,v.status,v.pass_score,v.max_attempts,
 c.created_by=jkc_user() AS can_edit,(jkc_head(c.owner_department_id) AND c.created_by<>jkc_user()) AS can_review,
 coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.order_no) FROM lessons l WHERE l.course_version_id=v.id),'[]') AS lessons,
 CASE WHEN v.status IN ('DRAFT','PENDING') THEN coalesce((SELECT jsonb_agg(jsonb_build_object('question',q.question,'options',
  (SELECT jsonb_agg(jsonb_build_object('answer_text',o.answer_text,'is_correct',o.is_correct) ORDER BY o.id) FROM quiz_options o WHERE o.question_id=q.id)) ORDER BY q.order_no)
  FROM quiz_questions q WHERE q.course_version_id=v.id),'[]') ELSE '[]'::jsonb END AS questions
 FROM courses c JOIN course_versions v ON v.course_id=c.id
 WHERE c.created_by=jkc_user() OR (jkc_head(c.owner_department_id) AND v.status IN ('PENDING','APPROVED'))
 ) t
$$;
CREATE FUNCTION jkc_course_workflow(action text,payload jsonb,req text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=jkc_user(); dept uuid; c courses; v course_versions; lesson jsonb; question jsonb; option jsonb;
 pos integer; qid uuid; oldq quiz_questions; newq uuid; l lessons; targets uuid[]; member uuid; target users; assigned uuid;
BEGIN
 SELECT department_id INTO dept FROM users WHERE id=actor AND is_active;
 IF actor IS NULL OR dept IS NULL THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
 IF action='create' THEN
  INSERT INTO courses(code,title,owner_department_id,created_by) VALUES('LMS-'||gen_random_uuid(),payload->>'title',dept,actor) RETURNING * INTO c;
  INSERT INTO course_versions(course_id,version_number,pass_score,max_attempts) VALUES(c.id,1,70,3) RETURNING * INTO v;
 ELSE
  SELECT * INTO c FROM courses WHERE id=(payload->>'course_id')::uuid FOR UPDATE;
  IF NOT FOUND OR NOT(c.created_by=actor OR jkc_head(c.owner_department_id)) THEN RAISE EXCEPTION 'JKC_NOT_FOUND'; END IF;
  SELECT * INTO v FROM course_versions WHERE id=(payload->>'version_id')::uuid AND course_id=c.id FOR UPDATE;
  IF NOT FOUND OR v.revision IS DISTINCT FROM (payload->>'revision')::integer THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
  IF action IN ('save','submit','fork') AND c.created_by<>actor THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
  IF action='save' THEN
   IF v.status<>'DRAFT' THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
   IF jsonb_array_length(payload->'lessons')<1 OR jsonb_array_length(payload->'questions')<1 OR
    (payload->>'pass_score')::numeric NOT BETWEEN 1 AND 100 OR (payload->>'max_attempts')::integer NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'JKC_INVALID'; END IF;
   DELETE FROM quiz_options WHERE question_id IN(SELECT id FROM quiz_questions WHERE course_version_id=v.id);
   DELETE FROM quiz_questions WHERE course_version_id=v.id;
   DELETE FROM lessons WHERE course_version_id=v.id;
   pos:=0;
   FOR lesson IN SELECT * FROM jsonb_array_elements(payload->'lessons') LOOP
    pos:=pos+1;
    INSERT INTO lessons(course_version_id,title,body,order_no) VALUES(v.id,lesson->>'title',lesson->'body',pos);
   END LOOP;
   pos:=0;
   FOR question IN SELECT * FROM jsonb_array_elements(payload->'questions') LOOP
    IF jsonb_array_length(question->'options')<2 OR (SELECT count(*) FROM jsonb_array_elements(question->'options') o WHERE (o->>'is_correct')::boolean)<>1 THEN RAISE EXCEPTION 'JKC_INVALID'; END IF;
    pos:=pos+1;
    INSERT INTO quiz_questions(course_version_id,question,order_no) VALUES(v.id,question->>'question',pos) RETURNING id INTO qid;
    FOR option IN SELECT * FROM jsonb_array_elements(question->'options') LOOP
     INSERT INTO quiz_options(question_id,answer_text,is_correct) VALUES(qid,option->>'answer_text',(option->>'is_correct')::boolean);
    END LOOP;
   END LOOP;
   UPDATE course_versions SET pass_score=(payload->>'pass_score')::numeric,max_attempts=(payload->>'max_attempts')::integer,revision=revision+1 WHERE id=v.id RETURNING * INTO v;
  ELSIF action='submit' THEN
   IF v.status<>'DRAFT' OR NOT EXISTS(SELECT 1 FROM lessons WHERE course_version_id=v.id) OR NOT EXISTS(SELECT 1 FROM quiz_questions WHERE course_version_id=v.id) THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
   UPDATE course_versions SET status='PENDING',revision=revision+1 WHERE id=v.id RETURNING * INTO v;
  ELSIF action='approve' THEN
   IF c.created_by=actor OR NOT jkc_head(c.owner_department_id) THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
   IF v.status<>'PENDING' THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
   UPDATE course_versions SET status='APPROVED',revision=revision+1,approved_by=actor,approved_at=now() WHERE id=v.id RETURNING * INTO v;
  ELSIF action='fork' THEN
   IF v.status<>'APPROVED' OR EXISTS(SELECT 1 FROM course_versions WHERE course_id=c.id AND status IN ('DRAFT','PENDING')) THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
   INSERT INTO course_versions(course_id,version_number,pass_score,max_attempts)
    SELECT c.id,max(version_number)+1,v.pass_score,v.max_attempts FROM course_versions WHERE course_id=c.id RETURNING id INTO assigned;
   INSERT INTO lessons(course_version_id,title,body,order_no) SELECT assigned,title,body,order_no FROM lessons WHERE course_version_id=v.id;
   FOR oldq IN SELECT * FROM quiz_questions WHERE course_version_id=v.id ORDER BY order_no LOOP
    INSERT INTO quiz_questions(course_version_id,question,order_no) VALUES(assigned,oldq.question,oldq.order_no) RETURNING id INTO newq;
    INSERT INTO quiz_options(question_id,answer_text,is_correct) SELECT newq,answer_text,is_correct FROM quiz_options WHERE question_id=oldq.id;
   END LOOP;
   SELECT * INTO v FROM course_versions WHERE id=assigned;
  ELSIF action='assign' THEN
   IF NOT jkc_head(c.owner_department_id) THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
   IF v.status<>'APPROVED' THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
   IF payload->>'department_id' IS NOT NULL THEN
    IF NOT jkc_head((payload->>'department_id')::uuid) THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
    SELECT array_agg(id) INTO targets FROM users WHERE is_active AND department_id=(payload->>'department_id')::uuid;
   ELSE targets:=ARRAY[(payload->>'user_id')::uuid]; END IF;
   IF coalesce(cardinality(targets),0)=0 OR targets[1] IS NULL THEN RAISE EXCEPTION 'JKC_INVALID'; END IF;
   FOREACH member IN ARRAY targets LOOP
    SELECT * INTO target FROM users WHERE id=member AND is_active;
    IF NOT FOUND OR NOT jkc_head(target.department_id) THEN RAISE EXCEPTION 'JKC_FORBIDDEN'; END IF;
    INSERT INTO course_assignments(course_version_id,user_id,due_at) VALUES(v.id,member,(payload->>'due_at')::timestamptz)
     ON CONFLICT DO NOTHING RETURNING id INTO assigned;
    IF assigned IS NOT NULL THEN
     INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,new_data,request_id)
      VALUES(actor,'COURSE_ASSIGNED','course_assignment',assigned,jsonb_build_object('user_id',member,'version_id',v.id,'due_at',payload->>'due_at'),req);
    END IF;
   END LOOP;
  ELSE RAISE EXCEPTION 'JKC_INVALID'; END IF;
 END IF;
 INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,new_data,request_id)
  VALUES(actor,'COURSE_'||upper(action),'course_version',v.id,jsonb_build_object('revision',v.revision,'status',v.status),req);
 RETURN jsonb_build_object('id',c.id,'version_id',v.id,'version_number',v.version_number,'revision',v.revision,'status',v.status);
END $$;
CREATE FUNCTION jkc_training_status(aid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN a.completed_at IS NOT NULL THEN 'COMPLETED'
  WHEN a.due_at<now() THEN 'OVERDUE'
  WHEN (SELECT count(*) FROM quiz_attempts q WHERE q.assignment_id=a.id AND q.submitted_at IS NOT NULL)>=v.max_attempts THEN 'FAILED'
  WHEN EXISTS(SELECT 1 FROM lesson_progress p WHERE p.assignment_id=a.id) OR EXISTS(SELECT 1 FROM quiz_attempts q WHERE q.assignment_id=a.id) THEN 'IN_PROGRESS'
  ELSE 'NOT_STARTED' END
 FROM course_assignments a JOIN course_versions v ON v.id=a.course_version_id JOIN courses c ON c.id=v.course_id
 WHERE a.id=aid AND (a.user_id=jkc_user() OR jkc_head(c.owner_department_id))
$$;
CREATE FUNCTION jkc_training_progress() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.title,t.full_name),'[]') FROM (
 SELECT a.id,a.user_id,u.full_name,c.title,v.version_number,a.due_at,a.completed_at,jkc_training_status(a.id) AS status
 FROM course_assignments a JOIN users u ON u.id=a.user_id JOIN course_versions v ON v.id=a.course_version_id JOIN courses c ON c.id=v.course_id
 WHERE jkc_head(c.owner_department_id) AND jkc_head(u.department_id)
 ) t
$$;
REVOKE ALL ON FUNCTION jkc_course_workspace(),jkc_course_workflow(text,jsonb,text),jkc_training_status(uuid),jkc_training_progress() FROM PUBLIC;
