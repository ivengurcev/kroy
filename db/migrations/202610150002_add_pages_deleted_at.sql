-- migrate:up
ALTER TABLE pages
ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- migrate:down
ALTER TABLE pages
DROP COLUMN deleted_at;
