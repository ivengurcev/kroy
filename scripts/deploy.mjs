import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRemoteHost, run, runRemoteScript } from './remoteUtils.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const [target, ...args] = process.argv.slice(2);

function usage() {
    console.error('Использование: yarn deploy app | yarn deploy site <slug>');
}

if (target === 'app' && args.length === 0) {
    getRemoteHost();
    process.exitCode = await run(
        'ansible-playbook',
        ['-i', join(ROOT, 'infra', 'ansible', 'inventory'), join(ROOT, 'infra', 'ansible', 'kroy-deploy.yml')],
        { cwd: ROOT },
    );
} else if (target === 'site' && args.length === 1 && SITE_SLUG_PATTERN.test(args[0])) {
    const host = getRemoteHost();
    process.exitCode = await runRemoteScript(host, 'site:publish', args);
} else {
    usage();
    process.exitCode = 1;
}
