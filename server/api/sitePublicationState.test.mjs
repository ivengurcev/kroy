import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pool } from '../../db/client.mjs';
import { getSitePublicationState } from './sitePublicationState.mjs';

test('publication state compares saved data with the active release across edits, restart and rollback', async (t) => {
    const root = await mkdtemp('/tmp/opencode/kroy-publication-');
    t.after(() => rm(root, { recursive: true, force: true }));
    const nginxDir = join(root, 'nginx');
    const sitesDir = join(root, 'sites');
    await mkdir(join(nginxDir, 'sites'), { recursive: true });
    const site = { id: 'site-a', slug: 'demo' };
    const options = { nginxDir, sitesDir };
    let currentFingerprint = 'saved-a';
    t.mock.method(pool, 'query', async (sql, values) => {
        assert.deepEqual(values, [site.id]);
        return { rows: [{ fingerprint: currentFingerprint }] };
    });

    assert.deepEqual(await getSitePublicationState(site, options), { hasChanges: true });
    async function release(id, fingerprint) {
        await mkdir(join(sitesDir, site.slug, id), { recursive: true });
        if (fingerprint) await writeFile(join(sitesDir, site.slug, id, 'source-fingerprint.json'), JSON.stringify({ fingerprint }));
        await writeFile(join(nginxDir, 'sites', 'demo.conf'), `# Kroy release: ${id}\n`);
    }
    await release('20261106000000000', 'saved-a');
    assert.deepEqual(await getSitePublicationState(site, options), { releaseId: '20261106000000000', hasChanges: false });
    currentFingerprint = 'saved-b';
    assert.equal((await getSitePublicationState(site, options)).hasChanges, true);
    await release('20261106000000001', 'saved-b');
    assert.equal((await getSitePublicationState(site, options)).hasChanges, false);
    // No job state participates: repeat reads and rollback follow the Nginx marker.
    assert.equal((await getSitePublicationState(site, options)).hasChanges, false);
    await release('20261106000000000', 'saved-a');
    assert.equal((await getSitePublicationState(site, options)).hasChanges, true);
    await release('20261105000000000');
    assert.equal((await getSitePublicationState(site, options)).hasChanges, true);
});
