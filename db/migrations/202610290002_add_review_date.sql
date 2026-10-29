-- migrate:up
ALTER TABLE reviews ADD COLUMN review_date DATE;

UPDATE reviews SET review_date = created_at::date;

ALTER TABLE reviews
    ALTER COLUMN review_date SET DEFAULT CURRENT_DATE,
    ALTER COLUMN review_date SET NOT NULL;

-- migrate:down
ALTER TABLE reviews DROP COLUMN review_date;
