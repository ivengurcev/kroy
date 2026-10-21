-- migrate:up
CREATE TABLE media (
    id UUID PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES sites(id),
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    size BIGINT NOT NULL CHECK (size > 0 AND size <= 10485760),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (site_id, filename)
);

-- migrate:down
DROP TABLE media;
