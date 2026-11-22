-- migrate:up
ALTER TABLE media DROP CONSTRAINT media_mime_type_check;
ALTER TABLE media ADD CONSTRAINT media_mime_type_check
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'));

-- migrate:down
ALTER TABLE media DROP CONSTRAINT media_mime_type_check;
ALTER TABLE media ADD CONSTRAINT media_mime_type_check
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp'));
