import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { transform } from '@svgr/core';

export default function createSiteSvgPlugin({ root }) {
    return {
        name: 'kroy-site-svg-react',
        setup(build) {
            build.onResolve({ filter: /\.svg\?react$/ }, (args) => {
                const [request, query] = args.path.split('?');
                if (query !== 'react') return undefined;

                return {
                    path: resolve(args.resolveDir || root, request),
                    namespace: 'kroy-site-svg-react',
                };
            });

            build.onLoad({ filter: /.*/, namespace: 'kroy-site-svg-react' }, async (args) => {
                const source = await readFile(args.path, 'utf8');
                const contents = await transform(
                    source,
                    {
                        exportType: 'default',
                        jsxRuntime: 'automatic',
                        plugins: ['@svgr/plugin-jsx'],
                        prettier: false,
                    },
                    { filePath: args.path }
                );

                return {
                    contents,
                    loader: 'jsx',
                    resolveDir: dirname(args.path),
                };
            });
        },
    };
}
