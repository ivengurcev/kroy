-- migrate:up
CREATE TABLE page_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 100),
    content jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(content) = 'array'),
    slot_index integer NOT NULL CHECK (slot_index BETWEEN 0 AND jsonb_array_length(content)),
    is_main boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
    UNIQUE (site_id, id)
);

CREATE UNIQUE INDEX page_templates_site_name_key ON page_templates (site_id, lower(name));
CREATE UNIQUE INDEX page_templates_one_main_per_site ON page_templates (site_id) WHERE is_main;

ALTER TABLE sites
    ADD COLUMN footer_version integer NOT NULL DEFAULT 1 CHECK (footer_version >= 1),
    ADD COLUMN default_template_id uuid,
    ADD CONSTRAINT sites_default_template_fkey
        FOREIGN KEY (id, default_template_id) REFERENCES page_templates(site_id, id);

ALTER TABLE pages
    ADD COLUMN template_mode text NOT NULL DEFAULT 'inherit',
    ADD COLUMN template_id uuid,
    ADD CONSTRAINT pages_template_mode_check
        CHECK ((template_mode IN ('inherit', 'none') AND template_id IS NULL)
            OR (template_mode = 'template' AND template_id IS NOT NULL)),
    ADD CONSTRAINT pages_template_fkey
        FOREIGN KEY (site_id, template_id) REFERENCES page_templates(site_id, id) ON DELETE RESTRICT;

CREATE INDEX pages_template_lookup ON pages (site_id, template_id) WHERE template_id IS NOT NULL;

INSERT INTO page_templates (site_id, name, slot_index, is_main)
SELECT id, 'Основной', 0, true FROM sites;

-- migrate:down
ALTER TABLE pages DROP COLUMN template_mode, DROP COLUMN template_id;
ALTER TABLE sites DROP COLUMN default_template_id, DROP COLUMN footer_version;
DROP TABLE page_templates;
