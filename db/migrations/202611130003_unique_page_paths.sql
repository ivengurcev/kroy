-- migrate:up
-- dbmate wraps this migration in a transaction. Prevent writes during cleanup.
LOCK TABLE pages, redirects IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE duplicate_page_removals ON COMMIT DROP AS
WITH RECURSIVE ranked AS (
    SELECT id, site_id, deleted_at,
           row_number() OVER (
               PARTITION BY site_id, path
               ORDER BY (deleted_at IS NULL) DESC, deleted_at DESC, id
           ) AS position
    FROM pages
), removals AS (
    SELECT id, site_id, deleted_at FROM ranked WHERE position > 1
    UNION
    SELECT p.id, p.site_id, p.deleted_at
    FROM pages p JOIN removals r ON p.site_id = r.site_id AND p.detail_parent_id = r.id
)
SELECT * FROM removals;

-- Inconsistent legacy dependencies must never cause deletion of live content.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM duplicate_page_removals WHERE deleted_at IS NULL) THEN
        RAISE EXCEPTION 'Duplicate URL cleanup would remove an active page or template; resolve its dependencies first';
    END IF;
END $$;

DELETE FROM redirects r USING duplicate_page_removals p
WHERE r.site_id = p.site_id AND r.page_id = p.id;
DELETE FROM pages p USING duplicate_page_removals r
WHERE p.site_id = r.site_id AND p.id = r.id;

DROP INDEX pages_site_id_path_key;
ALTER TABLE pages ADD CONSTRAINT pages_site_id_path_key UNIQUE (site_id, path);

-- migrate:down
-- Removed duplicate tombstones and their dependencies cannot be reconstructed.
ALTER TABLE pages DROP CONSTRAINT pages_site_id_path_key;
CREATE UNIQUE INDEX pages_site_id_path_key ON pages (site_id, path) WHERE deleted_at IS NULL;
