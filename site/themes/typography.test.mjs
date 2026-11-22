import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { build } from 'esbuild';
import { getThemeTokens, getThemeEditorModel, listThemes, setThemeOverride } from './themeRegistry.mjs';

const stylesheet = postcss.parse(readFileSync(new URL('../styles/SiteTheme.module.css', import.meta.url), 'utf8'));
const roles = ['small', 'body', 'lead', 'h6', 'h5', 'h4', 'h3', 'h2', 'h1', 'display'];

// Resolve the scale's CSS arithmetic without starting a browser or testing layout.
function sizesAt(tokens, width) {
    const declarations = { ...tokens };
    stylesheet.walkDecls(/^--site-font-size-/, (declaration) => {
        const query = declaration.parent.parent;
        if (query.type === 'atrule') {
            const minimum = query.params.match(/min-width:\s*(\d+)px/);
            if (!minimum || width < Number(minimum[1])) return;
        }
        if (declaration.prop !== '--site-font-size-base') declarations[declaration.prop] = declaration.value;
    });
    function evaluate(value) {
        const expression = value.replace(/var\((--site-[\w-]+)\)/g, (_, name) => `(${evaluate(declarations[name])})`)
            .replace(/calc\(/g, '(').replace(/px\b/g, '');
        assert.match(expression, /^[\d\s.()+*/-]+$/);
        return Function(`return (${expression})`)();
    }
    return roles.map((role) => evaluate(declarations[`--site-font-size-${role}`] ?? 'NaN'));
}

test('all themes scale every public text role with the shared base override', () => {
    const mobile = [14, 16, 18, 16, 18, 20, 24, 28, 36, 44];
    const desktop = [14, 16, 20, 18, 20, 24, 28, 36, 48, 64];
    for (const { id } of listThemes()) {
        for (const mode of ['light', 'dark', 'system']) {
            for (const base of [16, 18, 20]) {
                const overrides = setThemeOverride(id, 'shared', {}, '--site-font-size-base', `${base}px`);
                const tokens = getThemeTokens(id, mode, overrides);
                for (const width of [320, 375, 768, 1024, 1440]) {
                    const actual = sizesAt(tokens, width);
                    for (let index = 0; index < roles.length; index++) {
                        assert.ok(actual[index] >= mobile[index] * base / 16);
                        assert.ok(actual[index] <= desktop[index] * base / 16);
                        if (width <= 375 || width === 1440) {
                            const expected = width <= 375 ? mobile : desktop;
                            assert.equal(actual[index], expected[index] * base / 16, `${id}/${mode}/${base}/${width}/${roles[index]}`);
                        }
                    }
                }
            }
        }
        const model = getThemeEditorModel(id);
        assert.ok(!roles.some((role) => Object.hasOwn(model.shared, `--site-font-size-${role}`)), 'derived sizes must not become stored controls');
    }
});

function cssFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? cssFiles(path) : entry.name.endsWith('.css') ? [path] : [];
    });
}

test('public text sizes do not bypass the shared scale with fixed lengths', () => {
    const root = new URL('..', import.meta.url).pathname;
    const files = ['widgets', 'components', 'runtime', 'payments'].flatMap((directory) => cssFiles(join(root, directory)));
    const violations = [];
    for (const file of files) {
        postcss.parse(readFileSync(file, 'utf8')).walkDecls(/^(font|font-size)$/, (declaration) => {
            // Small marks and the divider diamond are decorative, not text roles.
            if (/^\.(maxMark|rule)$/.test(declaration.parent.selector)) return;
            if (/\d(?:px|rem|vw|cqw)\b/.test(declaration.value)) {
                violations.push(`${file}:${declaration.source.start.line}: ${declaration.toString()}`);
            }
        });
    }
    assert.deepEqual(violations, []);
});

test('public root bundles for SSR and keeps base overrides in the initial system palette', async () => {
    const result = await build({
        stdin: {
            contents: `import { createElement } from 'react';
                import { renderToString } from 'react-dom/server';
                import SiteRoot from './site/runtime/SiteRoot.jsx';
                export function render(theme) {
                    return renderToString(createElement(SiteRoot, { theme }, createElement('h1', null, 'Длинный заголовок')));
                }`,
            resolveDir: process.cwd(),
        },
        bundle: true,
        write: false,
        outfile: '/tmp/kroy-typography-ssr.js',
        format: 'esm',
        platform: 'node',
        jsx: 'automatic',
        loader: { '.ttf': 'file' },
    });
    const output = result.outputFiles.find((file) => file.path.endsWith('.js'));
    const { render } = await import(`data:text/javascript;base64,${Buffer.from(output.text).toString('base64')}`);
    for (const base of [16, 18, 20]) {
        const overrides = setThemeOverride('calm', 'shared', {}, '--site-font-size-base', `${base}px`);
        const light = getThemeTokens('calm', 'light', overrides);
        const dark = getThemeTokens('calm', 'dark', overrides);
        const initial = render({ mode: 'system', light, dark });
        assert.match(initial, new RegExp(`--site-font-size-base:${base}px`));
        assert.match(initial, /<h1>Длинный заголовок<\/h1>/);
        assert.equal(initial, render({ mode: 'light', light, dark }));
    }
    assert.ok(result.outputFiles.some((file) => file.path.endsWith('.css')));
});
