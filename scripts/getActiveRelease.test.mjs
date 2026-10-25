import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import getActiveRelease from './getActiveRelease.mjs';

test('reads active release from an Nginx fragment', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kroy-nginx-'));
    try {
        await writeFile(join(directory, 'demo.conf'), '# Kroy release: 20261025010101000\nserver {}\n');
        assert.equal(await getActiveRelease('demo', directory), '20261025010101000');
        assert.equal(await getActiveRelease('missing', directory), undefined);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
