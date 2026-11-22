-- migrate:up
ALTER TABLE sites
    ADD COLUMN separator_media_id UUID REFERENCES media(id) ON DELETE SET NULL;

-- migrate:down
ALTER TABLE sites DROP COLUMN separator_media_id;
