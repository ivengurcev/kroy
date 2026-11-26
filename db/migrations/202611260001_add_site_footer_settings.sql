-- migrate:up
ALTER TABLE sites ADD COLUMN footer_settings JSONB NOT NULL DEFAULT '{}'::jsonb
    CONSTRAINT sites_footer_settings_check CHECK (jsonb_typeof(footer_settings) = 'object');

-- migrate:down
ALTER TABLE sites DROP COLUMN footer_settings;
