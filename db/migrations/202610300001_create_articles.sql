-- migrate:up
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    content JSONB,
    cover_media_id UUID REFERENCES media(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    UNIQUE (site_id, slug),
    CHECK (content IS NULL OR jsonb_typeof(content) = 'object'),
    CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE INDEX articles_site_published_idx
    ON articles(site_id, published_at DESC)
    WHERE status = 'published';

-- migrate:down
DROP TABLE articles;
