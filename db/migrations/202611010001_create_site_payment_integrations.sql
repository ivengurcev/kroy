-- migrate:up
CREATE TABLE site_payment_integrations (
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (site_id, provider)
);

CREATE UNIQUE INDEX site_payment_integrations_one_active_per_site
    ON site_payment_integrations (site_id) WHERE is_active;

-- migrate:down
DROP TABLE site_payment_integrations;
