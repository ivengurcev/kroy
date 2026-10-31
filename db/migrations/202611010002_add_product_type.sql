-- migrate:up
ALTER TABLE products
    ADD COLUMN type TEXT NOT NULL DEFAULT 'service'
    CHECK (type IN ('service', 'goods'));

-- migrate:down
ALTER TABLE products DROP COLUMN type;
