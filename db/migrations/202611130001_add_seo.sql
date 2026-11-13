-- migrate:up
ALTER TABLE sites ADD COLUMN seo jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(seo) = 'object');
ALTER TABLE pages ADD COLUMN seo jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(seo) = 'object');

-- migrate:down
ALTER TABLE pages DROP COLUMN seo;
ALTER TABLE sites DROP COLUMN seo;
