-- migrate:up
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_superadmin BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

CREATE TYPE site_role AS ENUM ('admin');

CREATE TABLE site_memberships (
    site_id UUID NOT NULL REFERENCES sites(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role site_role NOT NULL,
    PRIMARY KEY (site_id, user_id)
);

CREATE INDEX site_memberships_user_id_idx ON site_memberships (user_id);

-- migrate:down
DROP TABLE site_memberships;
DROP TYPE site_role;
DROP TABLE users;
