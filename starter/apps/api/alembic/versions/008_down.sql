-- Rollback 008: khôi phục nguyên văn jkc_submit_quiz của 003 (không có kiểm tra JKC_ALREADY_PASSED).
CREATE OR REPLACE FUNCTION jkc_submit_quiz(attempt uuid, answers jsonb, req_id text)
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
REVOKE ALL ON FUNCTION jkc_submit_quiz(uuid,jsonb,text) FROM PUBLIC;
