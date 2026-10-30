import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { pool } from '../db/client.mjs';
import { createArticle, getArticle } from '../db/articles.mjs';
import { isPublishableArticle, patchSiteArticle } from './articles.mjs';

function context(hostname, id, body) {
    return {
        req: {
            header(name) {
                return name === 'Host' ? hostname : undefined;
            },
            param(name) {
                return name === 'id' ? id : undefined;
            },
            async json() {
                return body;
            },
        },
        json(value, status = 200) {
            return { value, status };
        },
    };
}

test('concurrent publish and content clearing preserve the publication invariant', async () => {
    assert.equal(process.env.PGDATABASE, 'kroy_articles_test', 'Run only against the isolated articles test database');
    const suffix = randomUUID();
    const hostname = `articles-${suffix}.example`;
    const site = (await pool.query(
        'INSERT INTO sites (slug, name) VALUES ($1, $2) RETURNING id',
        [`articles-${suffix}`, 'Articles test'],
    )).rows[0];
    await pool.query('INSERT INTO domains (site_id, hostname) VALUES ($1, $2)', [site.id, hostname]);

    try {
        const article = await createArticle(site.id, {
            slug: 'race',
            title: 'Race',
            summary: '',
            content: {
                root: {
                    type: 'root',
                    children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Body' }] }],
                },
            },
            coverMediaId: null,
            status: 'draft',
        });
        const emptyState = { root: { type: 'root', children: [] } };
        const [publish, clear] = await Promise.all([
            patchSiteArticle(context(hostname, article.id, { status: 'published' })),
            patchSiteArticle(context(hostname, article.id, { content: emptyState })),
        ]);

        assert.deepEqual([publish.status, clear.status].sort((a, b) => a - b), [200, 400]);
        const current = await getArticle(site.id, article.id);
        assert.equal(current.status !== 'published' || isPublishableArticle(current), true);
        if (current.status === 'published') assert.equal(current.content.root.children.length > 0, true);
    } finally {
        await pool.query('DELETE FROM domains WHERE site_id = $1', [site.id]);
        await pool.query('DELETE FROM sites WHERE id = $1', [site.id]);
        await pool.end();
    }
});
