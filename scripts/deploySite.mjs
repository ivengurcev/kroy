import { spawn } from 'node:child_process';

const siteSlug = process.argv[2];
if (!siteSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(siteSlug)) {
    console.error('Использование: yarn site:deploy <slug>');
    process.exitCode = 1;
} else {
    const child = spawn(
        'ssh',
        [
            'enduro-koltushi.ru',
            'sudo',
            '-n',
            '-u',
            'kroy',
            '/usr/local/sbin/kroy-site-deploy',
            siteSlug,
        ],
        { stdio: 'inherit' }
    );

    child.on('error', (error) => {
        console.error(`Не удалось запустить SSH: ${error.message}`);
        process.exitCode = 1;
    });

    child.on('exit', (code, signal) => {
        if (signal) {
            process.kill(process.pid, signal);
        } else {
            process.exitCode = code ?? 1;
        }
    });
}
