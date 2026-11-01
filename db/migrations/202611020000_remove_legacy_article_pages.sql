-- migrate:up
WITH RECURSIVE article_pages AS (
    SELECT site_id, id
    FROM pages
    WHERE data_source = 'articles'

    UNION

    SELECT child.site_id, child.id
    FROM pages AS child
    JOIN article_pages AS parent
      ON parent.site_id = child.site_id
     AND parent.id = child.detail_parent_id
    WHERE child.page_type = 'detail'
)
DELETE FROM redirects AS redirect
USING article_pages AS page
WHERE redirect.site_id = page.site_id
  AND redirect.page_id = page.id;

WITH RECURSIVE article_pages AS (
    SELECT site_id, id
    FROM pages
    WHERE data_source = 'articles'

    UNION

    SELECT child.site_id, child.id
    FROM pages AS child
    JOIN article_pages AS parent
      ON parent.site_id = child.site_id
     AND parent.id = child.detail_parent_id
    WHERE child.page_type = 'detail'
)
DELETE FROM pages AS page
USING article_pages AS article_page
WHERE page.site_id = article_page.site_id
  AND page.id = article_page.id;

UPDATE pages AS page
SET content = COALESCE(
    (
        SELECT jsonb_agg(block.value ORDER BY block.ordinality)
        FROM jsonb_array_elements(page.content) WITH ORDINALITY AS block(value, ordinality)
        WHERE block.value->>'part' IS DISTINCT FROM '@kroy/article'
          AND block.value->>'part' IS DISTINCT FROM '@kroy/article-list'
    ),
    '[]'::jsonb
)
WHERE page.page_type = 'standard'
  AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(page.content) AS block(value)
      WHERE block.value->>'part' IN ('@kroy/article', '@kroy/article-list')
  );

-- migrate:down
-- Legacy article pages and blocks cannot be restored.
