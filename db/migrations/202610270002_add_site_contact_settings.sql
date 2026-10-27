-- migrate:up
ALTER TABLE sites
    ADD COLUMN contact_settings JSONB NOT NULL DEFAULT '{"address":"","hours":"","phone":"","latitude":null,"longitude":null,"socials":[]}'::jsonb
        CHECK (jsonb_typeof(contact_settings) = 'object');

WITH first_contacts AS (
    SELECT DISTINCT ON (p.site_id)
        p.site_id,
        item->'props' AS props
    FROM pages p
    CROSS JOIN LATERAL jsonb_array_elements(p.content) AS item
    WHERE item->>'part' = '@kroy/contacts'
      AND p.deleted_at IS NULL
    ORDER BY p.site_id, p.path
), first_hero AS (
    SELECT DISTINCT ON (p.site_id)
        p.site_id,
        item->'props' AS props
    FROM pages p
    CROSS JOIN LATERAL jsonb_array_elements(p.content) AS item
    WHERE item->>'part' = '@kroy/hero'
      AND p.deleted_at IS NULL
    ORDER BY p.site_id, p.path
)
UPDATE sites s
SET contact_settings = jsonb_build_object(
    'address', COALESCE(first_contacts.props->'address', '""'::jsonb),
    'hours', COALESCE(first_contacts.props->'hours', '""'::jsonb),
    'phone', COALESCE(first_contacts.props->'phone', '""'::jsonb),
    'latitude', COALESCE(first_contacts.props->'latitude', 'null'::jsonb),
    'longitude', COALESCE(first_contacts.props->'longitude', 'null'::jsonb),
    'socials', COALESCE(first_hero.props->'socials', '[]'::jsonb)
)
FROM first_contacts
FULL JOIN first_hero ON first_hero.site_id = first_contacts.site_id
WHERE s.id = COALESCE(first_contacts.site_id, first_hero.site_id);

-- migrate:down
ALTER TABLE sites DROP COLUMN contact_settings;
