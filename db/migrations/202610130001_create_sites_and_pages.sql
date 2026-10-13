-- migrate:up
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
);

CREATE TABLE pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id),
    path TEXT NOT NULL,
    title TEXT NOT NULL,
    content JSONB NOT NULL DEFAULT '[]'::jsonb,
    UNIQUE (site_id, path),
    CHECK (jsonb_typeof(content) = 'array')
);

-- migrate:down
DROP TABLE pages;
DROP TABLE sites;
