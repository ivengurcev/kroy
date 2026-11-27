import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { watch } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';
import { get } from 'node:http';
import { JSDOM } from 'jsdom';
import { $generateNodesFromDOM } from '@lexical/html';
import { $getRoot, $getSelection, createEditor } from 'lexical';
import { registerNodeStructure } from '@lexical/extension';
import { pool } from '../../db/client.mjs';
import { createMainPageTemplate } from '../../db/pageTemplates.mjs';
import { getSiteFingerprint } from '../../db/siteFingerprint.mjs';
import { ensureNginxConfig } from '../../build/nginx/generateNginxConfig.mjs';
import { RICH_TEXT_HTML, RICH_TEXT_NODES } from '../../shared/lexicalEditor.mjs';
import { isDocumentText, legalDocumentBlock } from '../../shared/legalDocuments.mjs';
import { toLexicalDocument } from '../../admin/ui/richTextState.mjs';
import regression from '../../admin/ui/fixtures/nested-rich-text.mjs';
import getPage from './getPage.mjs';
import postPage from './postPage.mjs';
import putPage from './putPage.mjs';

const exec = promisify(execFile);

test('Word import → edit → page save → reopen → isolated static publication', async (t) => {
    if (process.env.RUN_WORD_PUBLICATION_TESTS !== '1') return t.skip('Requires isolated PostgreSQL and a private Nginx instance');
    assert.equal(process.env.RUN_PAGE_INTEGRATION_TESTS, '1');
    const { rows: [{ current_database: database }] } = await pool.query('SELECT current_database()');
    assert.equal(database, process.env.PAGE_TEST_DATABASE);
    assert.match(database, /test/i);
    const slug = `word-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const hostname = `${slug}.localhost`;
    const root = resolve('.');
    const directory = await mkdtemp('/tmp/opencode/word-publication-');
    const nginx = process.env.WORD_TEST_NGINX_BIN ?? '/usr/sbin/nginx';
    const config = join(directory, 'nginx.conf');
    let siteId;
    let nginxStarted = false;
    t.after(async () => {
        if (nginxStarted) await exec(nginx, ['-s', 'quit', '-c', config]);
        if (siteId) {
            await pool.query('DELETE FROM pages WHERE site_id = $1', [siteId]);
            await pool.query('DELETE FROM domains WHERE site_id = $1', [siteId]);
            await pool.query('DELETE FROM sites WHERE id = $1', [siteId]);
        }
        await pool.end();
        await rm(join(root, 'dist/sites', slug), { recursive: true, force: true });
        await rm(join(root, 'dist/kroy/staging', slug), { recursive: true, force: true });
        await rm(directory, { recursive: true, force: true });
    });
    const socket = createServer();
    await new Promise((done) => socket.listen(0, '127.0.0.1', done));
    const port = socket.address().port;
    await new Promise((done) => socket.close(done));
    await ensureNginxConfig({ outputDir: directory, listen: `127.0.0.1:${port}`, development: false });
    await exec(nginx, ['-c', config]);
    nginxStarted = true;

    const html = await readFile(new URL('../../admin/ui/fixtures/word-paste.html', import.meta.url), 'utf8');
    const dom = new JSDOM(html);
    t.after(() => dom.window.close());
    const editor = createEditor({ nodes: RICH_TEXT_NODES, html: RICH_TEXT_HTML, onError: (error) => { throw error; } });
    t.after(registerNodeStructure(editor));
    editor.update(() => {
        $getRoot().append(...$generateNodesFromDOM(editor, dom.window.document));
        $getRoot().getLastDescendant().selectEnd();
        $getSelection().insertText(' Проверено после редактирования.');
    }, { discrete: true });
    const text = JSON.parse(JSON.stringify(editor.getEditorState().toJSON()));
    assert.equal(isDocumentText(text), true);
    const publicDomain = `${slug}.example.org`;
    const { rows: [site] } = await pool.query('INSERT INTO sites (slug, name, seo) VALUES ($1, $1, $2) RETURNING id',
        [slug, { primaryDomain: publicDomain }]);
    siteId = site.id;
    await createMainPageTemplate(pool, siteId);
    await pool.query('INSERT INTO domains (site_id, hostname) VALUES ($1, $2)', [siteId, hostname]);
    await pool.query('INSERT INTO domains (site_id, hostname) VALUES ($1, $2)', [siteId, publicDomain]);
    const call = (api, body, id) => api({
        req: { header: () => hostname, param: () => id, json: async () => body, query: () => undefined },
        json: (value, status = 200) => ({ value, status }),
    });
    const { value: page, status } = await call(postPage, { title: 'Договор из Word', path: '/terms', isLegalDocument: true, content: text });
    assert.equal(status, 201);
    const reopened = await call(getPage, null, page.id);
    assert.deepEqual(reopened.content, [legalDocumentBlock(text)]);
    assert.equal(toLexicalDocument(reopened.content[0].props.content), reopened.content[0].props.content);
    const recovered = await call(postPage, { title: 'Восстановленный документ', path: '/recovered', isLegalDocument: true, content: regression });
    assert.equal(recovered.status, 201);
    assert.equal(isDocumentText(recovered.value.content[0].props.content), true);
    const resaved = await call(putPage, {
        content: [legalDocumentBlock(regression)], expectedLegalVersion: recovered.value.legalVersion,
    }, recovered.value.id);
    assert.equal(resaved.status, 200);
    assert.equal(isDocumentText(resaved.value.content[0].props.content), true);
    const invalid = await call(putPage, {
        content: [legalDocumentBlock({ root: { type: 'root', children: [{ type: 'unsupported', version: 1 }] } })],
        expectedLegalVersion: resaved.value.legalVersion,
    }, recovered.value.id);
    assert.equal(invalid.status, 400);
    assert.equal(invalid.value.details.length, 1);
    assert.equal(invalid.value.details[0].code, 'invalid_lexical');
    // Simulate an older saved row: publication repairs its snapshot, not the database.
    await pool.query('UPDATE pages SET content = $2 WHERE id = $1', [recovered.value.id, JSON.stringify([legalDocumentBlock(regression)])]);
    // nginx -s reload acknowledges the signal, not completion of the worker switch.
    // Wait for the old private worker's exit event rather than racing it with HTTP.
    const logPath = join(directory, 'logs/error.log');
    const log = await readFile(logPath, 'utf8');
    const workers = [...log.matchAll(/start worker process (\d+)/g)].map((match) => match[1]);
    assert.ok(workers.length);
    let logWatcher;
    let deadline;
    const switched = new Promise((done) => {
        const finish = (success) => { clearTimeout(deadline); logWatcher?.close(); done(success); };
        logWatcher = watch(logPath, async () => {
            try {
                const current = await readFile(logPath, 'utf8');
                if (workers.every((pid) => current.includes(`worker process ${pid} exited with code 0`))) finish(true);
            } catch { finish(false); }
        });
        logWatcher.on('error', () => finish(false));
        deadline = setTimeout(() => finish(false), 15000);
    });
    t.after(() => { clearTimeout(deadline); logWatcher?.close(); });
    const result = await exec('bun', ['scripts/publishSite.mjs', slug], {
        cwd: root, timeout: 120000,
        env: { ...process.env, NODE_ENV: 'production', NGINX_CONFIG_DIR: directory,
            NGINX_LISTEN: `127.0.0.1:${port}`, NGINX_UPSTREAM: '127.0.0.1:3000',
            NGINX_SITES_ROOT: join(root, 'dist/sites'), NGINX_BIN: nginx, KROY_NGINX_CONTROL_URL: '' },
    });
    assert.match(result.stdout, /Опубликован релиз/);
    assert.equal(await switched, true, 'private Nginx must complete the release switch before checking HTTP');
    const release = (await readFile(join(root, 'dist/kroy/staging', slug, '.published'), 'utf8')).trim();
    const fingerprint = JSON.parse(await readFile(join(root, 'dist/sites', slug, release, 'source-fingerprint.json'), 'utf8'));
    assert.equal(fingerprint.fingerprint, await getSiteFingerprint(siteId));
    const client = await readFile(join(root, 'dist/sites', slug, release, 'assets/app.js'), 'utf8');
    assert.doesNotMatch(client, /parseEditorState|registerNodeStructure|KroyTextConversion/, 'public bundle must not contain the Lexical engine');
    function readPublic(path) {
        return new Promise((done, fail) => {
            get({ hostname: '127.0.0.1', port, path, headers: { Host: hostname } }, (response) => {
                const chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('error', fail);
                response.on('end', () => done({ status: response.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
            }).on('error', fail);
        });
    }
    const response = await readPublic('/terms/');
    assert.equal(response.status, 200, await readFile(logPath, 'utf8'));
    const published = response.text;
    assert.match(published, /Договор оказания услуг/);
    assert.match(published, /Проверено после редактирования/);
    assert.match(published, /<h2><u><em><strong>Права и обязанности/);
    assert.match(published, /<ol start="3">/);
    assert.match(published, /href="\/contacts"/);
    assert.match(published, /href="\/terms">Договор из Word<\/a>/);
    const legacy = await readPublic('/recovered/');
    assert.equal(legacy.status, 200);
    assert.match(legacy.text, /<h2><u><em><strong>Условия договора/);
    const { rows: [unchanged] } = await pool.query('SELECT content FROM pages WHERE id = $1', [recovered.value.id]);
    assert.deepEqual(unchanged.content, [legalDocumentBlock(regression)]);
});
