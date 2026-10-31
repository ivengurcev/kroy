-- migrate:up
ALTER TABLE products DROP COLUMN payment_url;

-- migrate:down
ALTER TABLE products ADD COLUMN payment_url TEXT NOT NULL DEFAULT '';
