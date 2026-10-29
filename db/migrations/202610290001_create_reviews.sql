-- migrate:up
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 200),
    author_subtitle TEXT CHECK (author_subtitle IS NULL OR char_length(author_subtitle) BETWEEN 1 AND 300),
    text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 5000),
    media_id UUID REFERENCES media(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    moderated_at TIMESTAMPTZ
);

CREATE INDEX reviews_site_status_created_idx ON reviews(site_id, status, created_at DESC, id);

-- migrate:down
DROP TABLE reviews;
