-- migrate:up
ALTER TABLE pages DROP CONSTRAINT pages_site_id_path_key;
CREATE UNIQUE INDEX pages_site_id_path_key ON pages (site_id, path) WHERE deleted_at IS NULL;

-- migrate:down
-- Rollback deliberately fails if reused addresses still have deleted owners.
DROP INDEX pages_site_id_path_key;
ALTER TABLE pages ADD CONSTRAINT pages_site_id_path_key UNIQUE (site_id, path);
