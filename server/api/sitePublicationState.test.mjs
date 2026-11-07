import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from 'node:fs/promises';
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

test('fingerprint survives staging publication and only reports changes after saved data changes', async (t) => {
    const root = await mkdtemp('/tmp/opencode/kroy-fingerprint-release-');
    t.after(() => rm(root, { recursive: true, force: true }));
    const nginxDir = join(root, 'nginx');
    const sitesDir = join(root, 'sites');
    const stagingDir = join(root, 'staging');
    const site = { id: 'site-a', slug: 'demo' };
    const releaseId = '20261107000000000';
    await mkdir(join(nginxDir, 'sites'), { recursive: true });
    await mkdir(stagingDir, { recursive: true });
    const fingerprintFile = join(stagingDir, 'source-fingerprint.json');
    await writeFile(fingerprintFile, JSON.stringify({ fingerprint: 'saved-a' }));
    assert.deepEqual(JSON.parse(await readFile(fingerprintFile, 'utf8')), { fingerprint: 'saved-a' });
    await mkdir(join(sitesDir, site.slug), { recursive: true });
    await cp(stagingDir, join(sitesDir, site.slug, releaseId), { recursive: true });
    assert.deepEqual(JSON.parse(await readFile(join(sitesDir, site.slug, releaseId, 'source-fingerprint.json'), 'utf8')), { fingerprint: 'saved-a' });
    await writeFile(join(nginxDir, 'sites', 'demo.conf'), `# Kroy release: ${releaseId}\n`);

    let currentFingerprint = 'saved-a';
    t.mock.method(pool, 'query', async (_sql, values) => {
        assert.deepEqual(values, [site.id]);
        return { rows: [{ fingerprint: currentFingerprint }] };
    });
    const options = { nginxDir, sitesDir };
    assert.deepEqual(await getSitePublicationState(site, options), { releaseId, hasChanges: false });
    currentFingerprint = 'saved-b';
    assert.deepEqual(await getSitePublicationState(site, options), { releaseId, hasChanges: true });
});
