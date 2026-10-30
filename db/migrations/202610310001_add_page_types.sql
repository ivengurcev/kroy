-- migrate:up
ALTER TABLE pages
    ADD COLUMN page_type TEXT NOT NULL DEFAULT 'standard',
    ADD COLUMN data_source TEXT,
    ADD COLUMN detail_parent_id UUID,
    ADD COLUMN route_param TEXT;

ALTER TABLE pages
    ADD CONSTRAINT pages_page_type_check
        CHECK (page_type IN ('standard', 'list', 'detail')),
    ADD CONSTRAINT pages_type_fields_check
        CHECK (
            (page_type = 'standard' AND data_source IS NULL AND detail_parent_id IS NULL AND route_param IS NULL)
            OR (page_type = 'list' AND data_source IN ('articles', 'products', 'reviews') AND detail_parent_id IS NULL AND route_param IS NULL)
            OR (page_type = 'detail' AND data_source IS NULL AND detail_parent_id IS NOT NULL AND route_param ~ '^[A-Za-z][A-Za-z0-9_]*$')
        ),
    ADD CONSTRAINT pages_detail_parent_fk
        FOREIGN KEY (site_id, detail_parent_id)
        REFERENCES pages(site_id, id);

CREATE UNIQUE INDEX pages_one_detail_template_per_list
    ON pages (site_id, detail_parent_id)
    WHERE page_type = 'detail';

-- migrate:down
DROP INDEX pages_one_detail_template_per_list;

ALTER TABLE pages
    DROP CONSTRAINT pages_detail_parent_fk,
    DROP CONSTRAINT pages_type_fields_check,
    DROP CONSTRAINT pages_page_type_check,
    DROP COLUMN route_param,
    DROP COLUMN detail_parent_id,
    DROP COLUMN data_source,
    DROP COLUMN page_type;
