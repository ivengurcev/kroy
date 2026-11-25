-- migrate:up
ALTER TABLE pages ADD COLUMN appearance JSONB NOT NULL DEFAULT '{}'::jsonb
    CONSTRAINT pages_appearance_check CHECK (jsonb_typeof(appearance) = 'object');

-- migrate:down
ALTER TABLE pages DROP COLUMN appearance;
