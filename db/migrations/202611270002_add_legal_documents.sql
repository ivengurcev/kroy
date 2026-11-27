-- migrate:up
ALTER TABLE pages ADD COLUMN is_legal_document boolean NOT NULL DEFAULT false,
    ADD CONSTRAINT pages_legal_document_type_check CHECK (NOT is_legal_document OR page_type = 'standard');

-- migrate:down
ALTER TABLE pages DROP COLUMN is_legal_document;
