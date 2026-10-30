CREATE INDEX idx_reading_user ON reading_assignments(user_id,version_id);
CREATE INDEX idx_course_assignment_user ON course_assignments(user_id,course_version_id);
CREATE INDEX idx_attachments_version ON attachments(content_version_id);
CREATE UNIQUE INDEX uq_open_attempt ON quiz_attempts(assignment_id) WHERE submitted_at IS NULL;
ALTER TABLE quiz_attempts ADD COLUMN started_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN passed boolean, ADD COLUMN correct_count integer, ADD COLUMN question_count integer,
 ADD COLUMN pass_score_snapshot numeric(5,2);
ALTER TABLE course_versions ADD CONSTRAINT ck_positive_attempts CHECK(max_attempts>0);
ALTER TABLE attachments ALTER COLUMN content_version_id SET NOT NULL;
ALTER TABLE attachments ADD CONSTRAINT ck_scan_status CHECK(malware_scan_status IN ('PENDING','CLEAN','INFECTED','ERROR'));

CREATE FUNCTION jkc_user() RETURNS uuid LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT nullif(current_setting('jkc.user_id',true),'')::uuid
$$;
CREATE FUNCTION jkc_head(dept uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id
 WHERE u.id=jkc_user() AND u.is_active AND r.code='DEPARTMENT_HEAD' AND ur.scope_department_id=dept)
$$;
CREATE FUNCTION jkc_tech_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id
 WHERE u.id=jkc_user() AND u.is_active AND r.code='TECH_ADMIN')
$$;
CREATE FUNCTION jkc_acl_for(cid uuid, actor uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM contents c JOIN users u ON u.id=actor WHERE c.id=cid AND c.archived_at IS NULL AND u.is_active AND
 (c.visibility='COMPANY' OR (c.visibility='DEPARTMENT' AND c.owner_department_id=u.department_id)
 OR (c.visibility='CROSS_DEPARTMENT' AND EXISTS(SELECT 1 FROM content_acl a WHERE a.content_id=c.id AND a.department_id=u.department_id))
 OR (c.visibility='RESTRICTED' AND c.creator_id=u.id)))
$$;
CREATE FUNCTION jkc_review(cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM contents c WHERE c.id=cid AND c.kind='ARTICLE' AND c.creator_id<>jkc_user()
 AND jkc_head(c.owner_department_id) AND jkc_acl_for(c.id,jkc_user()))
$$;
CREATE FUNCTION jkc_version_read(vid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM content_versions v JOIN contents c ON c.id=v.content_id WHERE v.id=vid AND c.archived_at IS NULL
 AND ((c.creator_id=jkc_user()) OR (v.status='APPROVED' AND jkc_acl_for(c.id,jkc_user()))
 OR (v.status='PENDING' AND jkc_review(c.id) AND EXISTS(SELECT 1 FROM approvals a WHERE a.version_id=v.id AND
 (a.assigned_user_id IS NULL OR a.assigned_user_id=jkc_user())))))
$$;
CREATE FUNCTION jkc_assigned(cv uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM course_assignments a JOIN course_versions v ON v.id=a.course_version_id
 WHERE a.course_version_id=cv AND a.user_id=jkc_user() AND v.status='APPROVED')
$$;

ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_read ON contents FOR SELECT USING (creator_id=jkc_user() OR
 (current_published_version_id IS NOT NULL AND jkc_acl_for(id,jkc_user())) OR jkc_review(id));
CREATE POLICY content_insert ON contents FOR INSERT WITH CHECK (creator_id=jkc_user() AND kind='ARTICLE'
 AND visibility='DEPARTMENT' AND owner_department_id=(SELECT department_id FROM users WHERE id=jkc_user()) AND current_published_version_id IS NULL);
CREATE POLICY content_update ON contents FOR UPDATE USING (creator_id=jkc_user() OR jkc_review(id)) WITH CHECK (creator_id=jkc_user() OR jkc_review(id));
ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY version_read ON content_versions FOR SELECT USING (jkc_version_read(id));
CREATE POLICY version_insert ON content_versions FOR INSERT WITH CHECK (created_by=jkc_user() AND status='DRAFT'
 AND EXISTS(SELECT 1 FROM contents c WHERE c.id=content_id AND c.creator_id=jkc_user()));
CREATE POLICY version_update ON content_versions FOR UPDATE USING
 ((status='DRAFT' AND created_by=jkc_user()) OR (status='PENDING' AND jkc_review(content_id))) WITH CHECK
 ((status='PENDING' AND created_by=jkc_user()) OR (status='APPROVED' AND approved_by=jkc_user() AND jkc_review(content_id)));
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY approval_read ON approvals FOR SELECT USING(jkc_version_read(version_id));
CREATE POLICY approval_insert ON approvals FOR INSERT WITH CHECK(status='PENDING' AND EXISTS(SELECT 1 FROM content_versions v JOIN contents c ON c.id=v.content_id WHERE v.id=version_id AND v.status='PENDING' AND c.creator_id=jkc_user() AND c.owner_department_id=assigned_department_id));
CREATE POLICY approval_update ON approvals FOR UPDATE USING(jkc_head(assigned_department_id)
 AND (assigned_user_id IS NULL OR assigned_user_id=jkc_user()) AND EXISTS(SELECT 1 FROM content_versions v WHERE v.id=version_id AND jkc_review(v.content_id)))
 WITH CHECK(status='APPROVED' AND decided_by=jkc_user() AND jkc_head(assigned_department_id));
ALTER TABLE approval_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_read ON approval_events FOR SELECT USING(EXISTS(SELECT 1 FROM approvals a WHERE a.id=approval_id));
CREATE POLICY event_insert ON approval_events FOR INSERT WITH CHECK(actor_id=jkc_user() AND EXISTS(SELECT 1 FROM approvals a WHERE a.id=approval_id AND a.decided_by=jkc_user()));
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY attachment_read ON attachments FOR SELECT USING(jkc_version_read(content_version_id));
CREATE POLICY attachment_insert ON attachments FOR INSERT WITH CHECK(uploaded_by=jkc_user() AND EXISTS(
 SELECT 1 FROM content_versions v JOIN contents c ON c.id=v.content_id WHERE v.id=content_version_id AND v.status='DRAFT' AND c.creator_id=jkc_user()));
ALTER TABLE content_acl ENABLE ROW LEVEL SECURITY;
CREATE POLICY acl_read ON content_acl FOR SELECT USING(EXISTS(SELECT 1 FROM contents c WHERE c.id=content_id));
ALTER TABLE content_processes ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_read ON content_processes FOR SELECT USING(EXISTS(SELECT 1 FROM contents c WHERE c.id=content_id));
ALTER TABLE content_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tag_read ON content_tags FOR SELECT USING(EXISTS(SELECT 1 FROM contents c WHERE c.id=content_id));
ALTER TABLE reading_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY reading_read ON reading_assignments FOR SELECT USING(user_id=jkc_user() OR EXISTS(SELECT 1 FROM users u WHERE u.id=user_id AND jkc_head(u.department_id)));
CREATE POLICY reading_insert ON reading_assignments FOR INSERT WITH CHECK(EXISTS(SELECT 1 FROM users u WHERE u.id=user_id AND u.is_active AND jkc_head(u.department_id))
 AND EXISTS(SELECT 1 FROM content_versions v JOIN contents c ON c.id=v.content_id WHERE v.id=version_id AND c.kind='DOCUMENT' AND v.status='APPROVED' AND c.current_published_version_id=v.id AND jkc_acl_for(c.id,user_id)));
ALTER TABLE reading_acks ENABLE ROW LEVEL SECURITY;
CREATE POLICY ack_read ON reading_acks FOR SELECT USING(EXISTS(SELECT 1 FROM reading_assignments a WHERE a.id=assignment_id AND a.user_id=jkc_user()));
CREATE POLICY ack_insert ON reading_acks FOR INSERT WITH CHECK(EXISTS(SELECT 1 FROM reading_assignments a JOIN content_versions v ON v.id=a.version_id JOIN contents c ON c.id=v.content_id WHERE a.id=assignment_id AND a.user_id=jkc_user() AND v.status='APPROVED' AND c.current_published_version_id=v.id AND jkc_acl_for(c.id,jkc_user())));
ALTER TABLE course_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY learning_read ON course_assignments FOR SELECT USING(user_id=jkc_user());
CREATE POLICY learning_update ON course_assignments FOR UPDATE USING(user_id=jkc_user()) WITH CHECK(user_id=jkc_user());
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_read ON courses FOR SELECT USING(EXISTS(SELECT 1 FROM course_versions v WHERE v.course_id=courses.id AND jkc_assigned(v.id)));
ALTER TABLE course_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_version_read ON course_versions FOR SELECT USING(jkc_assigned(id));
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY lesson_read ON lessons FOR SELECT USING(jkc_assigned(course_version_id));
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY question_read ON quiz_questions FOR SELECT USING(jkc_assigned(course_version_id));
ALTER TABLE quiz_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY option_read ON quiz_options FOR SELECT USING(EXISTS(SELECT 1 FROM quiz_questions q WHERE q.id=question_id AND jkc_assigned(q.course_version_id)));
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY progress_read ON lesson_progress FOR SELECT USING(EXISTS(SELECT 1 FROM course_assignments a WHERE a.id=assignment_id AND a.user_id=jkc_user()));
CREATE POLICY progress_insert ON lesson_progress FOR INSERT WITH CHECK(EXISTS(SELECT 1 FROM course_assignments a JOIN lessons l ON l.course_version_id=a.course_version_id WHERE a.id=assignment_id AND a.user_id=jkc_user() AND l.id=lesson_id));
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY attempt_read ON quiz_attempts FOR SELECT USING(EXISTS(SELECT 1 FROM course_assignments a WHERE a.id=assignment_id AND a.user_id=jkc_user()));
CREATE POLICY attempt_insert ON quiz_attempts FOR INSERT WITH CHECK(submitted_at IS NULL AND score IS NULL AND passed IS NULL AND EXISTS(SELECT 1 FROM course_assignments a WHERE a.id=assignment_id AND a.user_id=jkc_user()));
ALTER TABLE quiz_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY response_read ON quiz_responses FOR SELECT USING(EXISTS(SELECT 1 FROM quiz_attempts a WHERE a.id=attempt_id));
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_role_read ON user_roles FOR SELECT USING(user_id=jkc_user());
CREATE POLICY user_role_insert ON user_roles FOR INSERT WITH CHECK(jkc_tech_admin() AND scope_department_id IS NULL AND role_id=(SELECT id FROM roles WHERE code='EMPLOYEE'));
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_insert ON audit_logs FOR INSERT WITH CHECK(actor_id=jkc_user());

CREATE FUNCTION jkc_fixed_history() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='quiz_attempts' AND OLD.submitted_at IS NULL AND TG_OP='UPDATE' THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'History is immutable';
END $$;
CREATE TRIGGER attempt_history BEFORE UPDATE OR DELETE ON quiz_attempts FOR EACH ROW EXECUTE FUNCTION jkc_fixed_history();
CREATE TRIGGER response_history BEFORE UPDATE OR DELETE ON quiz_responses FOR EACH ROW EXECUTE FUNCTION jkc_fixed_history();
CREATE TRIGGER reading_history BEFORE UPDATE OR DELETE ON reading_acks FOR EACH ROW EXECUTE FUNCTION jkc_fixed_history();
CREATE TRIGGER progress_history BEFORE UPDATE OR DELETE ON lesson_progress FOR EACH ROW EXECUTE FUNCTION jkc_fixed_history();
CREATE FUNCTION jkc_fixed_assignment() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Assignment history is immutable'; END IF;
 IF TG_TABLE_NAME='course_assignments' THEN
  IF NEW.user_id<>OLD.user_id OR NEW.course_version_id<>OLD.course_version_id THEN RAISE EXCEPTION 'Assignment version is immutable'; END IF;
 ELSE
  IF NEW.user_id<>OLD.user_id OR NEW.version_id<>OLD.version_id THEN RAISE EXCEPTION 'Assignment version is immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER course_assignment_history BEFORE UPDATE OR DELETE ON course_assignments FOR EACH ROW EXECUTE FUNCTION jkc_fixed_assignment();
CREATE TRIGGER reading_assignment_history BEFORE UPDATE OR DELETE ON reading_assignments FOR EACH ROW EXECUTE FUNCTION jkc_fixed_assignment();
CREATE FUNCTION jkc_fixed_course() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE cv uuid; old_cv uuid; frozen boolean; duplicate boolean;
BEGIN
 IF TG_TABLE_NAME='course_versions' THEN
  IF OLD.status='APPROVED' THEN RAISE EXCEPTION 'Approved course is immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='quiz_options' THEN
  IF TG_OP<>'DELETE' THEN SELECT q.course_version_id INTO cv FROM quiz_questions q WHERE q.id=NEW.question_id; END IF;
  IF TG_OP<>'INSERT' THEN SELECT q.course_version_id INTO old_cv FROM quiz_questions q WHERE q.id=OLD.question_id; END IF;
 ELSE
  IF TG_OP<>'DELETE' THEN cv=NEW.course_version_id; END IF;
  IF TG_OP<>'INSERT' THEN old_cv=OLD.course_version_id; END IF;
 END IF;
 SELECT EXISTS(SELECT 1 FROM course_versions WHERE id IN (cv,old_cv) AND status='APPROVED') INTO frozen;
 IF frozen THEN
  IF TG_OP='INSERT' THEN
   EXECUTE 'SELECT EXISTS(SELECT 1 FROM '||quote_ident(TG_TABLE_NAME)||' WHERE id=$1)' INTO duplicate USING NEW.id;
   IF duplicate THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'Approved course structure is immutable';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER frozen_course BEFORE UPDATE OR DELETE ON course_versions FOR EACH ROW EXECUTE FUNCTION jkc_fixed_course();
-- Structure updates/deletes are blocked; runtime has no INSERT/UPDATE grant on these tables.
CREATE TRIGGER frozen_lessons BEFORE INSERT OR UPDATE OR DELETE ON lessons FOR EACH ROW EXECUTE FUNCTION jkc_fixed_course();
CREATE TRIGGER frozen_questions BEFORE INSERT OR UPDATE OR DELETE ON quiz_questions FOR EACH ROW EXECUTE FUNCTION jkc_fixed_course();
CREATE TRIGGER frozen_options BEFORE INSERT OR UPDATE OR DELETE ON quiz_options FOR EACH ROW EXECUTE FUNCTION jkc_fixed_course();

CREATE FUNCTION jkc_submit_quiz(attempt uuid, answers jsonb, req_id text)
 RETURNS TABLE(id uuid, score numeric, passed boolean, correct_count integer, question_count integer, submitted_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a record; v record; total integer; correct integer; result numeric; pass boolean;
BEGIN
 SELECT ca.* INTO a FROM course_assignments ca JOIN quiz_attempts qa ON qa.assignment_id=ca.id WHERE qa.id=attempt FOR UPDATE OF ca;
 IF NOT FOUND OR a.user_id IS DISTINCT FROM jkc_user() THEN RAISE EXCEPTION 'JKC_NOT_FOUND'; END IF;
 SELECT qa.*,cv.pass_score,cv.status,cv.id AS cv_id INTO v FROM quiz_attempts qa JOIN course_assignments ca ON ca.id=qa.assignment_id JOIN course_versions cv ON cv.id=ca.course_version_id WHERE qa.id=attempt FOR UPDATE OF qa;
 IF v.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
 IF v.status<>'APPROVED' OR v.pass_score IS NULL THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
 SELECT count(*) INTO total FROM quiz_questions WHERE course_version_id=v.cv_id;
 IF total=0 OR jsonb_typeof(answers)<>'array' OR jsonb_array_length(answers)<>total THEN RAISE EXCEPTION 'JKC_INVALID'; END IF;
 IF (SELECT count(DISTINCT x->>'question_id') FROM jsonb_array_elements(answers) x)<>total THEN RAISE EXCEPTION 'JKC_INVALID'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(answers) x JOIN quiz_questions q ON q.id=(x->>'question_id')::uuid AND q.course_version_id=v.cv_id JOIN quiz_options o ON o.id=(x->>'option_id')::uuid AND o.question_id=q.id)<>total THEN RAISE EXCEPTION 'JKC_INVALID'; END IF;
 IF EXISTS(SELECT 1 FROM quiz_questions q WHERE q.course_version_id=v.cv_id AND (SELECT count(*) FROM quiz_options o WHERE o.question_id=q.id AND o.is_correct)<>1) THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM lessons l WHERE l.course_version_id=v.cv_id AND NOT EXISTS(SELECT 1 FROM lesson_progress p WHERE p.assignment_id=a.id AND p.lesson_id=l.id)) THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
 SELECT count(*) INTO correct FROM jsonb_array_elements(answers) x JOIN quiz_options o ON o.id=(x->>'option_id')::uuid WHERE o.is_correct;
 result=round(100.0*correct/total,2); pass=result>=v.pass_score;
 INSERT INTO quiz_responses(attempt_id,question_id,option_id) SELECT attempt,(x->>'question_id')::uuid,(x->>'option_id')::uuid FROM jsonb_array_elements(answers) x;
 UPDATE quiz_attempts qa SET score=result,passed=pass,correct_count=correct,question_count=total,pass_score_snapshot=v.pass_score,submitted_at=now() WHERE qa.id=attempt;
 IF pass THEN UPDATE course_assignments SET completed_at=COALESCE(completed_at,now()) WHERE course_assignments.id=a.id; END IF;
 INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,request_id) VALUES(jkc_user(),'QUIZ_SUBMITTED','quiz_attempt',attempt,req_id);
 RETURN QUERY SELECT qa.id,qa.score,qa.passed,qa.correct_count,qa.question_count,qa.submitted_at FROM quiz_attempts qa WHERE qa.id=attempt;
END $$;
-- Only the trusted runtime role receives explicit function/table grants during provisioning.
REVOKE ALL ON FUNCTION jkc_submit_quiz(uuid,jsonb,text) FROM PUBLIC;
CREATE FUNCTION jkc_ack_reading(task uuid, expected uuid, req_id text) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a record; inserted uuid;
BEGIN
 SELECT ra.*,c.current_published_version_id,v.status,v.effective_at,c.kind,c.id AS cid INTO a
 FROM reading_assignments ra JOIN content_versions v ON v.id=ra.version_id JOIN contents c ON c.id=v.content_id
 WHERE ra.id=task AND ra.user_id=jkc_user() FOR UPDATE OF ra,c;
 IF NOT FOUND OR a.kind<>'DOCUMENT' OR a.status<>'APPROVED' OR NOT jkc_acl_for(a.cid,jkc_user()) THEN RAISE EXCEPTION 'JKC_NOT_FOUND'; END IF;
 IF expected IS DISTINCT FROM a.version_id OR a.current_published_version_id IS DISTINCT FROM a.version_id OR a.effective_at>now() THEN RAISE EXCEPTION 'JKC_CONFLICT'; END IF;
 INSERT INTO reading_acks(assignment_id) VALUES(task) ON CONFLICT DO NOTHING RETURNING id INTO inserted;
 IF inserted IS NOT NULL THEN
  INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,request_id) VALUES(jkc_user(),'READ_ACKNOWLEDGED','reading_assignment',task,req_id);
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION jkc_ack_reading(uuid,uuid,text) FROM PUBLIC;

CREATE FUNCTION jkc_lock_assignment(aid uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM a.id FROM course_assignments a JOIN course_versions v ON v.id=a.course_version_id
 WHERE a.id=aid AND a.user_id=jkc_user() AND v.status='APPROVED' FOR UPDATE OF a;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION jkc_lock_assignment(uuid) FROM PUBLIC;
CREATE FUNCTION jkc_content_integrity() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.kind<>OLD.kind OR NEW.creator_id<>OLD.creator_id OR NEW.owner_department_id IS DISTINCT FROM OLD.owner_department_id OR NEW.visibility<>OLD.visibility THEN RAISE EXCEPTION 'Content identity and scope are immutable'; END IF;
 IF OLD.current_published_version_id IS NOT NULL AND NEW.title<>OLD.title THEN RAISE EXCEPTION 'Published metadata is immutable'; END IF;
 IF jkc_user() IS NOT NULL AND NEW.current_published_version_id IS DISTINCT FROM OLD.current_published_version_id AND NOT jkc_review(OLD.id) THEN RAISE EXCEPTION 'Only scoped reviewer can publish'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fixed_content BEFORE UPDATE ON contents FOR EACH ROW EXECUTE FUNCTION jkc_content_integrity();
CREATE FUNCTION jkc_version_integrity() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.status='APPROVED' THEN RETURN NEW; END IF;
 IF NEW.content_id<>OLD.content_id OR NEW.created_by<>OLD.created_by OR NEW.version_number<>OLD.version_number THEN RAISE EXCEPTION 'Version identity is immutable'; END IF;
 IF NEW.status='APPROVED' AND NEW.body<>OLD.body THEN RAISE EXCEPTION 'Approve the reviewed body without modification'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fixed_version BEFORE UPDATE ON content_versions FOR EACH ROW EXECUTE FUNCTION jkc_version_integrity();
