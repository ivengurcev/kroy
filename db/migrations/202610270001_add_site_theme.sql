-- migrate:up
ALTER TABLE sites
    ADD COLUMN theme_id TEXT NOT NULL DEFAULT 'calm',
    ADD COLUMN theme_mode TEXT NOT NULL DEFAULT 'light'
        CHECK (theme_mode IN ('light', 'dark', 'system')),
    ADD COLUMN theme_overrides JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(theme_overrides) = 'object');

-- migrate:down
ALTER TABLE sites
    DROP COLUMN theme_overrides,
    DROP COLUMN theme_mode,
    DROP COLUMN theme_id;
