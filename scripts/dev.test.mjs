import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { basename } from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

test('development restarts loaded API handlers after backend changes, without watching generated bundles', async (t) => {
    const directory = await mkdtemp('/tmp/opencode/dev-watch-test-');
    const children = [];
    const watchers = [];
    const beforeSignals = new Map(['SIGINT', 'SIGTERM'].map((signal) => [signal, process.listeners(signal)]));
    const runtime = {
        spawn(command, args) {
            const child = new EventEmitter();
            child.args = args;
            child.kills = [];
            child.kill = (signal) => child.kills.push(signal);
            children.push(child);
            return child;
        },
        watch(path, options, callback) {
            const watcher = { path, options, callback, closed: false, close() { this.closed = true; } };
            watchers.push(watcher);
            return watcher;
        },
    };
    globalThis.__kroyDevWatchTest = runtime;
    t.after(async () => {
        delete globalThis.__kroyDevWatchTest;
        for (const [signal, old] of beforeSignals) {
            for (const listener of process.listeners(signal)) if (!old.includes(listener)) process.removeListener(signal, listener);
        }
        await rm(directory, { recursive: true, force: true });
    });
    const compiled = await build({
        entryPoints: ['scripts/dev.mjs'], bundle: true, write: false, platform: 'node', format: 'esm',
        plugins: [{ name: 'dev-watch-unit', setup(builder) {
            builder.onResolve({ filter: /^node:(child_process|fs)$|\/discoverParts\.mjs$/ }, ({ path }) => ({ path, namespace: 'unit' }));
            builder.onLoad({ filter: /./, namespace: 'unit' }, ({ path }) => ({
                contents: path === 'node:fs' ? 'export const watch = (...args) => globalThis.__kroyDevWatchTest.watch(...args);'
                    : path === 'node:child_process' ? 'export const spawn = (...args) => globalThis.__kroyDevWatchTest.spawn(...args);'
                        : 'export const generateParts = async () => {};',
            }));
        } }],
    });
    const modulePath = `${directory}/dev.mjs`;
    await writeFile(modulePath, compiled.outputFiles[0].text);
    await import(pathToFileURL(modulePath).href);
    assert.equal(children.length, 2, 'one registry watcher and one application process');
    assert.deepEqual(watchers.slice(1).map(({ path }) => basename(path)), ['server', 'shared', 'db']);
    assert.equal(watchers.some(({ path }) => path.includes('/dist')), false);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    watchers[1].callback('change', 'api/putPage.test.mjs');
    watchers[0].callback('change', 'dist');
    t.mock.timers.tick(200);
    assert.deepEqual(children[1].kills, []);
    watchers[1].callback('change', 'api/putPage.mjs');
    watchers[2].callback('change', 'pageTemplates.mjs');
    t.mock.timers.tick(200);
    assert.deepEqual(children[1].kills, ['SIGTERM']);
    assert.deepEqual(children[0].kills, [], 'registry watcher remains alive across API restarts');
    children[1].emit('exit', null, 'SIGTERM');
    assert.equal(children.length, 3);
    assert.deepEqual(children[2].args, children[1].args);
    watchers[0].callback('rename', 'server.mjs');
    t.mock.timers.tick(200);
    children[2].emit('exit', null, 'SIGTERM');
    assert.equal(children.length, 4, 'atomic replacement of server.mjs is also observed');
    const stop = process.listeners('SIGTERM').find((listener) => !beforeSignals.get('SIGTERM').includes(listener));
    stop();
    assert.equal(watchers.every(({ closed }) => closed), true);
    assert.deepEqual(children[0].kills, ['SIGTERM']);
    assert.deepEqual(children[3].kills, ['SIGTERM']);
});
