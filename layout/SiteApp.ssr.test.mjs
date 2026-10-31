import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

let SiteApp;
let compiledPath;

before(async () => {
    const sourcePath = fileURLToPath(new URL('./SiteApp.jsx', import.meta.url));
    compiledPath = join(dirname(sourcePath), `.SiteApp-test-${randomUUID()}.mjs`);
    const result = await build({
        entryPoints: [sourcePath],
        outfile: compiledPath,
        bundle: true,
        write: false,
        packages: 'external',
        platform: 'node',
        format: 'esm',
        jsx: 'automatic',
        loader: { '.module.css': 'local-css' },
    });
    const output = result.outputFiles.find(({ path }) => path.endsWith('.mjs'));
    await writeFile(compiledPath, output.contents);
    ({ default: SiteApp } = await import(pathToFileURL(compiledPath).href));
});

after(async () => {
    if (compiledPath) await rm(compiledPath, { force: true });
});

test('SSR uses the current detail page payload when it is absent from the shared registry', () => {
    function Article({ context, record }) {
        return createElement('output', null, `${context.params.caseId}|${record.title}`);
    }
    const html = renderToStaticMarkup(createElement(SiteApp, {
        pages: {},
        path: '/cases/example',
        initialPage: {
            path: '/cases/example',
            title: 'Example',
            content: [{ part: 'article', props: {} }],
            context: { params: { caseId: 'example' } },
            record: { title: 'Example article' },
        },
        parts: { article: Article },
    }));

    assert.match(html, /example\|Example article/);
});
