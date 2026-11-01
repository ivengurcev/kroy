import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateParts } from '../build/registry/discoverParts.mjs';

export * from '../build/registry/discoverParts.mjs';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const parts = await generateParts();

    console.log(`Найдено запчастей: ${parts.length}`);

    for (const part of parts) {
        console.log(`  ${part.name}`);
    }
}
