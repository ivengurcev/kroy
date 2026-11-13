import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import generateSiteRouting from '../../build/site/generateSiteRouting.mjs';
import { renderNginxConfig } from '../../build/nginx/generateNginxConfig.mjs';

test('publication routing has one interpretation per URL: current HTML, 301, 410, or 404', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'page-routing-'));
    try {
        const file = join(directory, 'routing.json');
        await generateSiteRouting('test', [
            { from_path: '/moved', path: '/current', deleted_at: null },
            { from_path: '/reused', path: '/current', deleted_at: null },
            { from_path: '/current', path: '/current', deleted_at: null },
            { from_path: '/dead-alias', path: '/dead', deleted_at: 'now' },
            { from_path: '/news/item', path: '/dead', deleted_at: 'now' },
        ], [{ path: '/reused' }, { path: '/moved' }, { path: '/dead' }, { path: '/dead' }],
        file, ['/', '/current', '/reused', '/news/item']);
        const routing = JSON.parse(await readFile(file, 'utf8'));
        assert.deepEqual(routing, { redirects: [{ from: '/moved', to: '/current', status: 301 }], gone: ['/dead', '/dead-alias'] });
        const config = renderNginxConfig('test', ['test.example'], { routing });
        assert.match(config, /return 301 "\/current"/);
        assert.match(config, /location = "\/dead" \{\n\s+return 410/);
        assert.doesNotMatch(config, /location = "\/(reused|current|news\/item)"/);
        assert.match(config, /try_files \$uri \$uri\/ \$uri\/index.html =404/);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
