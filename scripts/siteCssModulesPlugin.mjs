import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

function moduleName(root, filePath, localName) {
    const relativePath = relative(root, filePath).replaceAll(sep, '/');
    const pathToken = Buffer.from(relativePath).toString('base64url');
    return `kroy_${pathToken}__${localName}`;
}

function transformCss(source, root, filePath) {
    const names = [...new Set([...source.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((match) => match[1]))];
    const mapping = Object.fromEntries(names.map((name) => [name, moduleName(root, filePath, name)]));
    const css = source.replace(/\.([A-Za-z_][\w-]*)/g, (match, name) => `.${mapping[name] ?? name}`);
    return { css, mapping };
}

function fileKey(root, filePath) {
    return Buffer.from(relative(root, filePath).replaceAll(sep, '/')).toString('base64url');
}

export default function createSiteCssModulesPlugin({ root, emitCss }) {
    const mappings = new Map();
    const files = new Map();

    return {
        mappings,
        plugin: {
            name: `kroy-site-css-modules-${emitCss ? 'client' : 'ssr'}`,
            setup(build) {
                build.onResolve({ filter: /\.module\.css$/ }, (args) => {
                    if (args.path.startsWith('kroy-site-css-content/')) return undefined;
                    const sourcePath = resolve(args.resolveDir || root, args.path);
                    const key = fileKey(root, sourcePath);
                    files.set(key, sourcePath);
                    return { path: key, namespace: 'kroy-site-css-module' };
                });

                build.onLoad({ filter: /.*/, namespace: 'kroy-site-css-module' }, async (args) => {
                    const key = args.path.split('/').pop();
                    const sourcePath = files.get(key);
                    if (!sourcePath) throw new Error(`Не найден CSS Module: ${key}`);
                    const source = await readFile(sourcePath, 'utf8');
                    const { mapping } = transformCss(source, root, sourcePath);
                    const relativePath = relative(root, sourcePath);
                    mappings.set(relativePath, mapping);
                    const importCss = emitCss ? `import ${JSON.stringify(`kroy-site-css-content/${key}`)};` : '';
                    return {
                        contents: `${importCss}\nexport default ${JSON.stringify(mapping)};`,
                        loader: 'js',
                        resolveDir: root,
                    };
                });

                build.onResolve({ filter: /^kroy-site-css-content\// }, (args) => ({
                    path: args.path.slice('kroy-site-css-content/'.length),
                    namespace: 'kroy-site-css-content',
                }));

                build.onLoad({ filter: /.*/, namespace: 'kroy-site-css-content' }, async (args) => {
                    const key = args.path.split('/').pop();
                    const sourcePath = files.get(key);
                    if (!sourcePath) throw new Error(`Не найден CSS Module для стилей: ${key}`);
                    const source = await readFile(sourcePath, 'utf8');
                    return {
                        contents: transformCss(source, root, sourcePath).css,
                        loader: 'css',
                        resolveDir: root,
                    };
                });
            },
        },
    };
}
