-- migrate:up
ALTER TABLE pages
ADD CONSTRAINT pages_site_id_id_unique UNIQUE (site_id, id);

CREATE TABLE redirects (
    site_id UUID NOT NULL REFERENCES sites(id),
    from_path TEXT NOT NULL,
    page_id UUID NOT NULL,
    UNIQUE (site_id, from_path),
    FOREIGN KEY (site_id, page_id) REFERENCES pages(site_id, id)
);

-- migrate:down
DROP TABLE redirects;

ALTER TABLE pages
DROP CONSTRAINT pages_site_id_id_unique;
