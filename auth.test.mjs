import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { pool } from './db/client.mjs';
import { createUser } from './db/users.mjs';
import { hasAccess } from './auth.mjs';

test('hasAccess enforces active users and site memberships', async () => {
    assert.equal(process.env.PGDATABASE, 'kroy_auth_test', 'Run only against the isolated auth test database');
    const suffix = randomUUID();
    try {
        const [superadmin, siteAdmin, otherAdmin, blocked] = await Promise.all([
            createUser({ email: `super-${suffix}@example.org`, password: 'test', is_superadmin: true }),
            createUser({ email: `admin-${suffix}@example.org`, password: 'test' }),
            createUser({ email: `other-${suffix}@example.org`, password: 'test' }),
            createUser({ email: `blocked-${suffix}@example.org`, password: 'test' }),
        ]);
        await pool.query("UPDATE users SET status = 'blocked' WHERE id = $1", [blocked.id]);
        const sites = (await pool.query(
            `INSERT INTO sites (slug, name) VALUES ($1, $2), ($3, $4) RETURNING id, slug`,
            [`auth-${suffix}-one`, 'One', `auth-${suffix}-two`, 'Two'],
        )).rows;
        const domains = [
            [`one-${suffix}.example`, sites[0].id],
            [`two-${suffix}.example`, sites[1].id],
        ];
        for (const [hostname, siteId] of domains) {
            await pool.query('INSERT INTO domains (site_id, hostname) VALUES ($1, $2)', [siteId, hostname]);
        }
        await pool.query(
            `INSERT INTO site_memberships (site_id, user_id, role)
             VALUES ($1, $2, 'admin'), ($3, $2, 'admin'), ($1, $4, 'admin')`,
            [sites[0].id, siteAdmin.id, sites[1].id, otherAdmin.id],
        );
        const request = (hostname) => ({ req: { header: (name) => name === 'Host' ? hostname : undefined } });
        const session = (user) => ({ session: { user: { id: user.id, email: user.email } } });

        assert.equal(await hasAccess(session(superadmin), {}, request('unknown.example')), true);
        assert.equal(await hasAccess(session(siteAdmin), {}, request(domains[0][0])), true);
        assert.equal(await hasAccess(session(siteAdmin), {}, request(domains[1][0])), true);
        assert.equal(await hasAccess(session(otherAdmin), {}, request(domains[0][0])), true);
        assert.equal(await hasAccess(session(otherAdmin), {}, request(domains[1][0])), false);
        assert.equal(await hasAccess(session(blocked), {}, request(domains[0][0])), false);
        assert.equal(await hasAccess(session(siteAdmin), {}, request('missing.example')), false);
        assert.equal(await hasAccess({ session: { user: { id: otherAdmin.id, email: siteAdmin.email } } }, {}, request(domains[0][0])), false);
        assert.equal(await hasAccess(session(siteAdmin), {}), false);
    } finally {
        await pool.end();
    }
});
