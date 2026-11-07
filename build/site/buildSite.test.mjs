import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('build writes source fingerprint after renderSite clears and renders the staging directory', async () => {
    const source = await readFile(fileURLToPath(new URL('./buildSite.mjs', import.meta.url)), 'utf8');
    const renderPosition = source.indexOf('await renderSite(site, renderPages, temporaryDirectory, ASSET_BASE);');
    const fingerprintPosition = source.indexOf("await writeFile(join(temporaryDirectory, 'source-fingerprint.json')");
    assert.ok(renderPosition >= 0);
    assert.ok(fingerprintPosition > renderPosition);
    assert.match(source, /sourceFingerprint = await getSiteFingerprint\(site\.id, client\)/);
});
