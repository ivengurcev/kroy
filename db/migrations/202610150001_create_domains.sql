-- migrate:up
CREATE TABLE domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id),
    hostname TEXT NOT NULL UNIQUE,
    CHECK (hostname = lower(hostname)),
    CHECK (hostname = btrim(hostname) AND hostname <> ''),
    CHECK (hostname NOT LIKE '%://%'),
    CHECK (hostname NOT LIKE '%:%'),
    CHECK (right(hostname, 1) <> '.')
);

-- migrate:down
DROP TABLE domains;
