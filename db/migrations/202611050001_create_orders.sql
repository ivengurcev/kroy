-- migrate:up
ALTER TABLE sites ADD COLUMN order_notification_email text;

CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    public_token text NOT NULL UNIQUE,
    items_total numeric(12,2) NOT NULL CHECK (items_total > 0),
    currency text NOT NULL DEFAULT 'RUB' CHECK (currency = 'RUB'),
    payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
    fulfillment_status text NOT NULL DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'completed')),
    customer_phone text,
    customer_email text,
    customer_extra text,
    is_test boolean NOT NULL DEFAULT false,
    site_origin text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz,
    completed_at timestamptz,
    UNIQUE (site_id, id),
    CHECK ((payment_status = 'paid') = (paid_at IS NOT NULL)),
    CHECK ((fulfillment_status = 'completed') = (completed_at IS NOT NULL)),
    CHECK (fulfillment_status <> 'completed' OR payment_status = 'paid')
);
CREATE INDEX orders_site_created_idx ON orders(site_id, created_at DESC, id);

CREATE TABLE order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id uuid,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('service', 'goods')),
    unit_price numeric(12,2) NOT NULL CHECK (unit_price > 0),
    quantity integer NOT NULL CHECK (quantity > 0),
    sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX order_items_order_idx ON order_items(order_id, sort_order, id);

CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL,
    order_id uuid NOT NULL,
    provider text NOT NULL,
    merchant_domain text NOT NULL,
    external_id text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
    provider_status text,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    currency text NOT NULL CHECK (currency = 'RUB'),
    is_test boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    confirmed_at timestamptz,
    FOREIGN KEY (site_id, order_id) REFERENCES orders(site_id, id) ON DELETE CASCADE,
    UNIQUE (order_id, provider),
    UNIQUE (provider, merchant_domain, external_id),
    CHECK ((status = 'succeeded') = (confirmed_at IS NOT NULL))
);

CREATE TABLE order_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event text NOT NULL CHECK (event = 'order.paid'),
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    UNIQUE (order_id, event)
);

-- migrate:down
DROP TABLE order_notifications;
DROP TABLE payments;
DROP TABLE order_items;
DROP TABLE orders;
ALTER TABLE sites DROP COLUMN order_notification_email;
