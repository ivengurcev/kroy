import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

async function confirm() {
    if (!stdin.isTTY) {
        console.error('Откат миграции требует интерактивного терминала.');
        process.exit(1);
    }

    const readline = createInterface({ input: stdin, output: stdout });
    const answer = await readline.question('Откатить последнюю миграцию? [y/N] ');
    readline.close();
    return /^y(es)?$/i.test(answer.trim());
}

if (!(await confirm())) {
    console.log('Отменено.');
} else {
    const child = spawn('dbmate', ['rollback'], { stdio: 'inherit' });
    child.on('error', (error) => {
        console.error(`Не удалось запустить dbmate: ${error.message}`);
        process.exitCode = 1;
    });
    child.on('exit', (code, signal) => {
        if (signal) {
            process.kill(process.pid, signal);
            return;
        }
        process.exitCode = code ?? 1;
    });
}
