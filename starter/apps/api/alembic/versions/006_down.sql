DROP FUNCTION jkc_training_progress();
DROP FUNCTION jkc_training_status(uuid);
DROP FUNCTION jkc_course_workspace();
DROP FUNCTION jkc_course_workflow(text,jsonb,text);
ALTER TABLE course_versions DROP COLUMN revision, DROP COLUMN approved_by, DROP COLUMN approved_at;
