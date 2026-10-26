import { watch } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateParts } from './discoverParts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PARTS_DIR = resolve(ROOT, 'parts');
let timer;
let running = false;
let queued = false;

async function regenerate() {
    if (running) {
        queued = true;
        return;
    }

    running = true;
    try {
        await generateParts();
        console.log('Реестр запчастей обновлён');
    } catch (error) {
        console.error('Не удалось обновить реестр запчастей:', error);
    } finally {
        running = false;
        if (queued) {
            queued = false;
            await regenerate();
        }
    }
}

await regenerate();
const watcher = watch(PARTS_DIR, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => void regenerate(), 100);
});

console.log(`Наблюдение за ${PARTS_DIR}`);
process.once('SIGINT', () => watcher.close());
process.once('SIGTERM', () => watcher.close());
