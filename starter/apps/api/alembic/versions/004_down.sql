DROP FUNCTION jkc_workspace_people();
DROP FUNCTION jkc_reading_manage(text,jsonb,text);
DROP FUNCTION jkc_content_workspace();
DROP FUNCTION jkc_content_workflow(text,jsonb,text);
CREATE OR REPLACE FUNCTION jkc_review(cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM contents c WHERE c.id=cid AND c.kind='ARTICLE' AND c.creator_id<>jkc_user()
 AND jkc_head(c.owner_department_id) AND jkc_acl_for(c.id,jkc_user()))
$$;
DROP FUNCTION jkc_hr(uuid,boolean);
ALTER TABLE content_versions DROP COLUMN revision, DROP COLUMN process_id;
-- Keep operator-assigned HR role identities rather than deleting user grants.
