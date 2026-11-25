import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';
import { pool } from '../../db/client.mjs';
import postMedia from '../api/postMedia.mjs';
import getMedia from '../api/getMedia.mjs';
import { getMediaPath, MAX_MEDIA_SIZE } from './storage.mjs';
import sanitizeSvg from './sanitizeSvg.mjs';
import processImage from './processImage.mjs';
import { SVG_CONTENT_SECURITY_POLICY } from '../../shared/mediaPolicy.mjs';
import generateNginxConfig, { renderNginxConfig } from '../../build/nginx/generateNginxConfig.mjs';

const namespace = 'http://www.w3.org/2000/svg';
const shape = '<path id="shape" d="M0 0h24v24H0z" fill="#123456"/>';
const svg = (content, attributes = '') => `<svg xmlns="${namespace}" width="24" height="24" viewBox="0 0 24 24" ${attributes}>${content}</svg>`;
const parser = new (new JSDOM('').window.DOMParser)();

function assertStatic(source) {
    const document = parser.parseFromString(source, 'image/svg+xml');
    assert.equal(document.documentElement.localName, 'svg');
    assert.equal(document.documentElement.namespaceURI, namespace);
    assert.equal(document.querySelector('parsererror'), null);
    assert.equal(document.doctype, null);
    assert.equal(document.querySelector('script, foreignObject, style, image, a, animate, set'), null);
    for (const node of document.querySelectorAll('*')) {
        for (const attribute of node.attributes) {
            assert.ok(!attribute.name.toLowerCase().startsWith('on'));
            assert.notEqual(attribute.name, 'style');
            assert.doesNotMatch(attribute.value, /javascript:|https:\/\/evil|data:|file:|@import|expression\(/i);
        }
    }
    return document;
}

async function upload(t, source) {
    const siteId = randomUUID();
    const directory = dirname(getMediaPath(siteId, `${randomUUID()}.svg`));
    t.after(() => rm(directory, { recursive: true, force: true }));
    let stored;
    const client = {
        async query(sql, values) {
            if (sql.includes('JOIN domains')) return { rows: [{ id: siteId }] };
            if (sql.includes('INSERT INTO media')) {
                stored = { id: values[0], site_id: values[1], filename: values[2], mime_type: values[3], size: values[4] };
            }
            return { rows: [] };
        },
        release() {},
    };
    t.mock.method(pool, 'connect', async () => client);
    const form = new FormData();
    // Intentionally misleading MIME/name: Sharp must still identify the bytes.
    form.set('file', new File([source], 'icon.png', { type: 'image/png' }));
    const response = await postMedia({
        req: {
            header: (name) => ({ Host: 'svg.localhost', 'Content-Type': 'multipart/form-data; boundary=test' })[name],
            raw: { formData: async () => form },
        },
        json: (value, status) => ({ value, status }),
    });
    if (!stored) return { response, directory };
    const bytes = await readFile(getMediaPath(siteId, stored.filename));
    assert.equal(stored.size, bytes.length);
    assert.equal(stored.mime_type, 'image/svg+xml');
    assert.ok(stored.filename.endsWith('.svg'));
    assert.deepEqual(await readdir(directory), [stored.filename]);
    return { response, bytes, stored, directory };
}

const cases = [
    ['safe vector', svg(shape)],
    ['script', svg(`<script>alert(1)</script>${shape}`)],
    ['event handlers', svg('<path d="M0 0h24v24z" onclick="alert(1)"/>', 'onload="alert(1)"')],
    ['foreignObject and HTML', svg(`${shape}<foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src="https://evil/x" onerror="alert(1)"/></div></foreignObject>`)],
    ['javascript links', svg(`${shape}<use href="javascript:alert(1)"/><a href="javascript:alert(1)"><path d="M0 0h1"/></a>`)],
    ['external resources', svg(`${shape}<image href="https://evil/x"/><use href="//evil/icon.svg#x"/><use href="data:image/svg+xml,test"/><use href="file:///etc/passwd"/><rect width="2" height="2" fill="url(https://evil/x)" stroke="url(//evil/x)" mask="url(https://evil/m)" clip-path="url(https://evil/c)"/>`)],
    ['dangerous CSS', svg(`${shape}<style>@import url(https://evil/x); path { fill: url(https://evil/x) }</style><rect width="2" height="2" style="fill:url(https://evil/x);background:expression(alert(1))" fill="u\\72l(https://evil/x)"/>`)],
    ['animation and XML base', svg(`${shape}<animate attributeName="href" values="javascript:alert(1)"/><set attributeName="onload" to="alert(1)"/><use href="#shape" xml:base="https://evil/x"/>`)],
];

for (const [name, source] of cases) {
    test(`upload saves only sanitized SVG: ${name}`, async (t) => {
        const { response, bytes } = await upload(t, source);
        assert.equal(response.status, 201);
        assertStatic(bytes.toString());
        assert.equal(response.value.mimeType, 'image/svg+xml');
        assert.match(bytes.toString(), /<path/);
    });
}

test('saved SVG retains viewBox, multiple paths, gradients, masks, clipping and local references', async (t) => {
    const source = svg(`<defs>
        <linearGradient id="gradient"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient>
        <radialGradient id="radial" href="#gradient"/>
        <mask id="mask"><rect width="24" height="24" fill="white"/></mask>
        <clipPath id="clip"><circle cx="12" cy="12" r="10"/></clipPath>
        <path id="icon-path" d="M1 1h2v2z"/>
    </defs><g mask="url(#mask)" clip-path="url('#clip')">
        <path d="M0 0h24v24z" fill="url(#gradient)"/><path d="M2 2h4v4z" fill="url(#radial)"/>
        <use href="#icon-path"/><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#icon-path"/>
    </g>`);
    const { response, bytes } = await upload(t, source);
    assert.equal(response.status, 201);
    const document = assertStatic(bytes.toString());
    assert.equal(document.documentElement.getAttribute('viewBox'), '0 0 24 24');
    assert.equal(document.querySelectorAll('path').length, 3);
    assert.equal(document.querySelector('linearGradient').id, 'gradient');
    assert.equal(document.querySelector('radialGradient').getAttribute('href'), '#gradient');
    assert.equal(document.querySelector('g').getAttribute('mask'), 'url(#mask)');
    assert.equal(document.querySelector('g').getAttribute('clip-path'), "url('#clip')");
    assert.equal(document.querySelector('use').getAttribute('href'), '#icon-path');
    assert.equal(document.querySelectorAll('use')[1].getAttributeNS('http://www.w3.org/1999/xlink', 'href'), '#icon-path');
    assert.equal((await sharp(bytes).metadata()).format, 'svg');
});

const invalid = [
    ['DOCTYPE', `<!DOCTYPE svg>${svg(shape)}`],
    ['external entity', `<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>${svg('<text>&xxe;</text>')}`],
    ['external DTD', `<!DOCTYPE svg SYSTEM "https://evil/document.dtd">${svg(shape)}`],
    ['invalid XML', svg(shape).replace('</svg>', '</broken>')],
    ['empty SVG', svg('')],
    ['only active content', svg('<script>alert(1)</script>')],
    ['non-SVG root', '<html><body>not an image</body></html>'],
];
for (const [name, source] of invalid) {
    test(`upload rejects ${name} without saving original bytes`, async (t) => {
        const { response, directory } = await upload(t, source);
        assert.deepEqual(response, { status: 400, value: { error: 'Invalid image' } });
        await assert.rejects(readdir(directory), { code: 'ENOENT' });
        assert.throws(() => sanitizeSvg(Buffer.from(source)));
    });
}

test('sanitizer enforces input and serialized output limits', () => {
    assert.throws(() => sanitizeSvg(Buffer.alloc(MAX_MEDIA_SIZE + 1)));
    // Unnamespaced SVG gains xmlns during serialization and can exceed the limit.
    const base = '<svg width="24" height="24"><path d="M0 0h1"/><desc></desc></svg>';
    const source = base.replace('<desc>', `<desc>${'x'.repeat(MAX_MEDIA_SIZE - Buffer.byteLength(base))}`);
    assert.equal(Buffer.byteLength(source), MAX_MEDIA_SIZE);
    assert.throws(() => sanitizeSvg(Buffer.from(source)), /Invalid image/);
});

test('common exports without xmlns work; dangling fragments are removed', () => {
    const output = sanitizeSvg(Buffer.from('<svg viewBox="0 0 24 24"><path d="M0 0h1" fill="url(#missing)"/><use href="#missing"/></svg>'));
    const document = assertStatic(output.toString());
    assert.equal(document.querySelector('path').hasAttribute('fill'), false);
    assert.equal(document.querySelector('use').hasAttribute('href'), false);
});

test('text remains static text, not XML markup', async (t) => {
    const { response, bytes } = await upload(t, svg('<text x="1" y="12">Hello &amp; &lt;world&gt;<tspan>!</tspan></text>'));
    assert.equal(response.status, 201);
    const document = assertStatic(bytes.toString());
    assert.equal(document.querySelector('text').textContent, 'Hello & <world>!');
});

test('namespace tricks, encoded URLs and non-fragment paints do not survive', () => {
    const source = svg(`${shape}
        <use xmlns:xlink="https://evil/namespace" xlink:href="#shape"/>
        <use href="java&#x73;cript:alert(1)"/>
        <path d="M1 1h1" fill="url(&quot;https://evil/x&quot;)" stroke="URL(https://evil/x)"/>
        <g xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></g>`);
    const document = assertStatic(sanitizeSvg(Buffer.from(source)).toString());
    assert.equal(document.querySelector('use').hasAttribute('xlink:href'), false);
});

test('API serves saved SVG bytes with sandbox, nosniff and site isolation', async (t) => {
    const { stored, bytes } = await upload(t, svg(`<script>alert(1)</script>${shape}`));
    t.mock.method(pool, 'query', async (sql, values) => {
        assert.match(sql, /JOIN domains d ON d.site_id = m.site_id/);
        assert.match(sql, /d.hostname = \$2/);
        return { rows: values[0] === stored.id && values[1] === 'svg.localhost' ? [stored] : [] };
    });
    const context = (hostname) => ({
        req: { param: () => stored.id, header: () => hostname },
        body: (body, status, headers) => ({ body, status, headers }),
        json: (body, status) => ({ body, status }),
    });
    const result = await getMedia(context('svg.localhost'));
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, bytes);
    assertStatic(result.body.toString());
    assert.equal(result.headers['Content-Type'], 'image/svg+xml');
    assert.equal(result.headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(result.headers['Content-Security-Policy'], SVG_CONTENT_SECURITY_POLICY);
    assert.match(result.headers['Content-Security-Policy'], /^sandbox;/);
    assert.equal((await getMedia(context('other.localhost'))).status, 404);
});

test('published release and staging SVG locations retain protective headers', () => {
    const config = renderNginxConfig('demo', ['svg.localhost'], {
        releaseId: '20261125000000000',
        siteRoot: 'demo/20261125000000000',
    });
    for (const location of ['location ^~ /_kroy/releases/', 'location ~ ^/assets/.+\\.svg$']) {
        const block = config.slice(config.indexOf(location)).split('}')[0];
        assert.ok(block.includes(`add_header Content-Security-Policy "${SVG_CONTENT_SECURITY_POLICY}" always;`));
        assert.ok(block.includes('add_header X-Content-Type-Options nosniff always;'));
    }
});

test('Nginx serves sanitized release files with sandbox and nosniff over HTTP', {
    skip: spawnSync('nginx', ['-v']).status !== 0 ? 'nginx is not installed' : false,
}, async (t) => {
    const { bytes } = await upload(t, svg(`${shape}<script>alert(1)</script>`));
    const temporary = await mkdtemp('/tmp/opencode/svg-nginx-');
    let runningConfig;
    t.after(async () => {
        try {
            if (runningConfig) execFileSync('nginx', ['-p', temporary, '-c', runningConfig, '-s', 'stop']);
        } finally {
            await rm(temporary, { recursive: true, force: true });
        }
    });
    await chmod(temporary, 0o755);
    const releaseId = '20261125000000000';
    const sitesRoot = join(temporary, 'sites');
    const assets = join(sitesRoot, 'demo', releaseId, 'assets');
    await mkdir(assets, { recursive: true });
    await writeFile(join(assets, 'icon.svg'), bytes);

    const socket = createServer();
    await new Promise((resolve, reject) => {
        socket.once('error', reject);
        socket.listen(0, '127.0.0.1', resolve);
    });
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    const { configPath } = await generateNginxConfig('demo', ['svg.localhost'], {
        sitesRoot,
        outputDir: join(temporary, 'nginx'),
        siteRoot: `demo/${releaseId}`,
        releaseId,
        listen: `127.0.0.1:${port}`,
        development: false,
        routing: { redirects: [], gone: [] },
    });
    execFileSync('nginx', ['-p', temporary, '-c', configPath]);
    runningConfig = configPath;
    for (const url of [`/_kroy/releases/${releaseId}/assets/icon.svg`, '/assets/icon.svg']) {
        const response = await fetch(`http://127.0.0.1:${port}${url}`, { headers: { Host: 'svg.localhost' } });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Content-Type'), 'image/svg+xml');
        assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
        assert.equal(response.headers.get('Content-Security-Policy'), SVG_CONTENT_SECURITY_POLICY);
        const served = Buffer.from(await response.arrayBuffer());
        assert.deepEqual(served, bytes);
        assertStatic(served.toString());
    }
});

test('raster processing still outputs WebP and honors resizing', async () => {
    const input = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#f00' } }).png().toBuffer();
    const result = await processImage(input, { maxWidth: 10 });
    assert.equal(result.format, 'webp');
    const metadata = await sharp(result.bytes).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 10);
    assert.equal(metadata.height, 5);
});
