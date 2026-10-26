import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRemoteHost, runRemoteScript } from './remoteUtils.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLOCKED_SCRIPTS = new Set(['remote', 'deploy', 'site:deploy']);
const [script, ...args] = process.argv.slice(2);

if (!script) {
    console.error('Использование: yarn remote <script> [...args]');
    process.exitCode = 1;
} else {
    const packageScripts = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts || {};
    if (!Object.hasOwn(packageScripts, script) || BLOCKED_SCRIPTS.has(script)) {
        console.error(`Неизвестный или запрещённый скрипт: ${script}`);
        process.exitCode = 1;
    } else {
        const host = getRemoteHost();
        process.exitCode = await runRemoteScript(host, script, args, { tty: true });
    }
}
