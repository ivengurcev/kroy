import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
    chmodSync, createReadStream, createWriteStream, existsSync, lstatSync, mkdirSync, mkdtempSync,
    readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { getRemoteHost } from './remoteUtils.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const [command, ...rest] = args;
const isProduction = ROOT === '/srv/kroy' || process.env.KROY_BACKUP_ENV === 'production';
const BACKUPS = join(ROOT, 'data/backups');
const FORMAT_VERSION = 1;
const DEV_COMPOSE = ['compose', '-f', 'infra/compose.yaml'];
process.umask(0o077);

function fail(message) {
    throw new Error(message);
}

function run(commandName, commandArgs, options = {}) {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(commandName, commandArgs, { cwd: ROOT, stdio: 'inherit', ...options });
        child.once('error', reject);
        child.once('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`${commandName} завершилась с кодом ${code ?? 1}`)));
    });
}

function output(commandName, commandArgs, options = {}) {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(commandName, commandArgs, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], ...options });
        const chunks = [];
        child.stdout.on('data', (chunk) => chunks.push(chunk));
        child.once('error', reject);
        child.once('exit', (code) => code === 0 ? resolvePromise(Buffer.concat(chunks)) : reject(new Error(`${commandName} завершилась с кодом ${code ?? 1}`)));
    });
}

function databaseUrl() {
    if (process.env.DATABASE_URL) return connectionSettings(process.env.DATABASE_URL);
    if (isProduction) {
        const env = readFileSync(join(ROOT, '.env'), 'utf8');
        const value = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
        if (value) return connectionSettings(value.replace(/^(['"])(.*)\1$/, '$2'));
        fail('В .env не найдена DATABASE_URL.');
    }
    return connectionSettings('postgres://kroy:kroy-local@db:5432/kroy?sslmode=disable');
}

function connectionSettings(value) {
    const url = new URL(value);
    const env = {
        PGHOST: url.hostname,
        PGPORT: url.port || '5432',
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    };
    for (const [key, variable] of [
        ['sslmode', 'PGSSLMODE'], ['connect_timeout', 'PGCONNECT_TIMEOUT'],
        ['application_name', 'PGAPPNAME'], ['sslrootcert', 'PGSSLROOTCERT'],
        ['sslcert', 'PGSSLCERT'], ['sslkey', 'PGSSLKEY'],
        ['target_session_attrs', 'PGTARGETSESSIONATTRS'], ['gssencmode', 'PGGSSENCMODE'],
    ]) {
        if (url.searchParams.has(key)) env[variable] = url.searchParams.get(key);
    }
    return env;
}

async function dumpDatabase(destination) {
    if (isProduction) {
        const connection = databaseUrl();
        await run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', `--dbname=${connection.PGDATABASE}`, `--file=${destination}`], {
            env: { ...process.env, ...connection },
        });
    } else {
        await run('docker', [...DEV_COMPOSE, 'up', '-d', 'db']);
        const child = spawn('docker', [...DEV_COMPOSE, 'exec', '-T', 'db', 'pg_dump', '--format=custom', '--no-owner', '--no-acl', '-U', 'kroy', 'kroy'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
        const written = pipeline(child.stdout, createWriteStream(destination, { mode: 0o600, flags: 'wx' }));
        const exited = new Promise((resolvePromise, reject) => {
            child.once('error', reject);
            child.once('exit', resolvePromise);
        });
        const [code] = await Promise.all([exited, written]);
        if (code !== 0) fail(`pg_dump завершилась с кодом ${code ?? 1}`);
    }
}

async function restoreDatabase(dump) {
    if (isProduction) fail('Восстановление production запрещено: текущие права и инфраструктура не позволяют остановить приложение и исключить конкурирующие записи.');
    const child = spawn('docker', [...DEV_COMPOSE, 'exec', '-T', 'db', 'pg_restore', '--clean', '--if-exists', '--exit-on-error', '--single-transaction', '--no-owner', '--no-acl', '-U', 'kroy', '-d', 'kroy'], { cwd: ROOT, stdio: ['pipe', 'inherit', 'inherit'] });
    const exited = new Promise((resolvePromise, reject) => {
        child.once('error', reject);
        child.once('exit', resolvePromise);
    });
    const [code] = await Promise.all([exited, pipeline(createReadStream(dump), child.stdin)]);
    if (code !== 0) fail(`pg_restore завершилась с кодом ${code ?? 1}; транзакция отменена.`);
}

async function digest(path) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    return hash.digest('hex');
}

async function mediaManifest(directory, prefix = 'media') {
    const files = {};
    for (const name of readdirSync(directory).sort()) {
        const path = join(directory, name);
        const info = lstatSync(path);
        if (info.isSymbolicLink()) fail('media содержит символическую ссылку.');
        if (info.isDirectory()) Object.assign(files, await mediaManifest(path, `${prefix}/${name}`));
        else if (info.isFile()) files[`${prefix}/${name}`] = { size: info.size, sha256: await digest(path) };
        else fail('media содержит неподдерживаемый тип файла.');
    }
    return files;
}

async function createArchive(destination) {
    const parent = dirname(destination);
    mkdirSync(parent, { recursive: true, mode: 0o700 });
    if (parent === BACKUPS) chmodSync(parent, 0o700);
    if (existsSync(destination)) fail(`Файл уже существует: ${destination}`);
    const work = mkdtempSync(join(tmpdir(), 'kroy-backup-'));
    chmodSync(work, 0o700);
    const staging = `${destination}.partial-${randomUUID()}`;
    const verification = mkdtempSync(join(tmpdir(), 'kroy-backup-check-'));
    chmodSync(verification, 0o700);
    try {
        await dumpDatabase(join(work, 'database.dump'));
        const mediaRoot = join(ROOT, 'data/media');
        if (existsSync(mediaRoot)) symlinkSync(mediaRoot, join(work, 'media'));
        else mkdirSync(join(work, 'media'));
        const manifest = {
            formatVersion: FORMAT_VERSION,
            createdAt: new Date().toISOString(),
            files: {
                'database.dump': { size: statSync(join(work, 'database.dump')).size, sha256: await digest(join(work, 'database.dump')) },
                ...await mediaManifest(join(work, 'media')),
            },
        };
        writeFileSync(join(work, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
        await run('tar', ['-hczf', staging, '-C', work, 'manifest.json', 'database.dump', 'media']);
        chmodSync(staging, 0o600);
        await validateArchive(staging, verification);
        renameSync(staging, destination);
        console.log(`Резервная копия создана: ${destination}`);
    } finally {
        rmSync(work, { recursive: true, force: true });
        rmSync(verification, { recursive: true, force: true });
        rmSync(staging, { force: true });
    }
}

async function validateArchive(archive, destination) {
    const listing = (await output('tar', ['-tzf', archive])).toString().split('\n').filter(Boolean);
    if (!listing.includes('manifest.json') || !listing.includes('database.dump') || !listing.includes('media/')) fail('Архив не соответствует формату Kroy.');
    if (listing.some((item) => item.startsWith('/') || item.split('/').includes('..') || !['manifest.json', 'database.dump', 'media/'].includes(item) && !item.startsWith('media/'))) {
        fail('Архив содержит недопустимые пути.');
    }
    const verbose = (await output('tar', ['-tvzf', archive])).toString();
    if (verbose.split('\n').some((line) => /^[lh]/.test(line.slice(0, 1)))) fail('Символические и жёсткие ссылки в архиве запрещены.');
    mkdirSync(destination, { recursive: true, mode: 0o700 });
    await run('tar', ['-xzf', archive, '-C', destination]);
    const manifest = JSON.parse(readFileSync(join(destination, 'manifest.json'), 'utf8'));
    if (manifest.formatVersion !== FORMAT_VERSION) fail('Неподдерживаемая версия формата архива.');
    const dump = join(destination, 'database.dump');
    if (manifest.files?.['database.dump']?.size !== statSync(dump).size || manifest.files?.['database.dump']?.sha256 !== await digest(dump)) fail('Контрольная сумма или размер дампа не совпадает.');
    const expected = manifest.files || {};
    const actual = await mediaManifest(join(destination, 'media'));
    if (JSON.stringify(Object.keys(actual).sort()) !== JSON.stringify(Object.keys(expected).filter((name) => name.startsWith('media/')).sort())) fail('Состав media не совпадает с manifest.json.');
    for (const [name, file] of Object.entries(actual)) {
        if (expected[name]?.size !== file.size || expected[name]?.sha256 !== file.sha256) fail(`Контрольная сумма или размер не совпадает: ${name}`);
    }
    await checkDump(dump);
    return { manifest, dump, media: join(destination, 'media') };
}

async function checkDump(dump) {
    const child = spawn('pg_restore', ['--list'], { cwd: ROOT, stdio: ['pipe', 'ignore', 'inherit'] });
    const exited = new Promise((resolvePromise, reject) => {
        child.once('error', (error) => reject(new Error(`Не удалось запустить pg_restore для проверки дампа: ${error.message}`)));
        child.once('exit', resolvePromise);
    });
    const [code] = await Promise.all([exited, pipeline(createReadStream(dump), child.stdin)]);
    if (code !== 0) fail(`pg_restore --list завершилась с кодом ${code ?? 1}`);
}

async function validateOnly(archive) {
    const work = mkdtempSync(join(tmpdir(), 'kroy-verify-'));
    chmodSync(work, 0o700);
    try { await validateArchive(archive, work); }
    finally { rmSync(work, { recursive: true, force: true }); }
}

async function restoreArchive(archive) {
    if (isProduction) fail('Восстановление production запрещено: сначала настройте maintenance mode и полномочия на остановку kroy-app.');
    const resolved = resolve(archive);
    if (!existsSync(resolved)) fail(`Архив не найден: ${resolved}`);
    const work = mkdtempSync(join(tmpdir(), 'kroy-restore-'));
    chmodSync(work, 0o700);
    const mediaRoot = join(ROOT, 'data/media');
    const restoreId = randomUUID();
    const stagedMedia = join(ROOT, 'data', `.media-restore-${restoreId}`);
    const previousMedia = join(ROOT, 'data', `.media-before-restore-${restoreId}`);
    let before;
    let appWasRunning = false;
    let appStopped = false;
    let restoreStarted = false;
    let databaseRestored = false;
    let preserveStagedMedia = false;
    const oldMediaEntries = [];
    const newMediaEntries = [];
    try {
        const { dump, media } = await validateArchive(resolved, work);
        if (!existsSync(mediaRoot) || !lstatSync(mediaRoot).isDirectory() || lstatSync(mediaRoot).isSymbolicLink()) {
            fail('Каталог data/media должен быть обычным каталогом bind mount.');
        }
        appWasRunning = (await output('docker', [...DEV_COMPOSE, 'ps', '--status', 'running', '--services', 'app']))
            .toString().trim().split('\n').includes('app');
        if (appWasRunning) {
            await run('docker', [...DEV_COMPOSE, 'stop', 'app']);
            appStopped = true;
        }

        before = join(BACKUPS, `before-restore-${new Date().toISOString().replaceAll(':', '-')}.tar.gz`);
        await createArchive(before);

        mkdirSync(stagedMedia, { recursive: true, mode: 0o700 });
        await run('cp', ['-a', `${media}/.`, `${stagedMedia}/`]);

        restoreStarted = true;
        await restoreDatabase(dump);
        databaseRestored = true;
        mkdirSync(previousMedia, { mode: 0o700 });
        for (const name of readdirSync(mediaRoot)) {
            renameSync(join(mediaRoot, name), join(previousMedia, name));
            oldMediaEntries.push(name);
        }
        for (const name of readdirSync(stagedMedia)) {
            renameSync(join(stagedMedia, name), join(mediaRoot, name));
            newMediaEntries.push(name);
        }
        if (appWasRunning) await run('docker', [...DEV_COMPOSE, 'start', 'app']);
        try { rmSync(previousMedia, { recursive: true, force: true }); }
        catch (cleanupError) { console.error(`Старое содержимое media осталось в ${previousMedia}: ${cleanupError.message}`); }
        console.log(`Восстановление завершено. Предыдущие данные сохранены в ${before}`);
    } catch (error) {
        const rollbackErrors = [];
        const recoveryPaths = [];
        const restoredOldMedia = new Set();
        let safeToRollback = !appWasRunning || !restoreStarted;
        if (appWasRunning) {
            try {
                if (restoreStarted) await run('docker', [...DEV_COMPOSE, 'stop', 'app']);
                else await run('docker', [...DEV_COMPOSE, 'start', 'app']);
                appStopped = restoreStarted;
                safeToRollback = true;
            } catch (rollbackError) {
                rollbackErrors.push(`не удалось вернуть прежнее состояние приложения: ${rollbackError.message}`);
            }
        }
        if (safeToRollback) {
            for (const name of newMediaEntries) {
                try { rmSync(join(mediaRoot, name), { recursive: true, force: true }); }
                catch (rollbackError) {
                    rollbackErrors.push(`не удалось удалить новые media ${name}: ${rollbackError.message}`);
                    recoveryPaths.push(join(mediaRoot, name));
                }
            }
            for (const name of oldMediaEntries) {
                try {
                    if (!existsSync(join(previousMedia, name))) fail(`исходный файл media ${name} отсутствует в previousMedia`);
                    renameSync(join(previousMedia, name), join(mediaRoot, name));
                    restoredOldMedia.add(name);
                } catch (rollbackError) {
                    rollbackErrors.push(`не удалось вернуть media ${name}: ${rollbackError.message}`);
                    recoveryPaths.push(previousMedia);
                }
            }
            if (databaseRestored && before) {
                const rollbackWork = mkdtempSync(join(tmpdir(), 'kroy-db-rollback-'));
                chmodSync(rollbackWork, 0o700);
                try {
                    const oldState = await validateArchive(before, rollbackWork);
                    await restoreDatabase(oldState.dump);
                } catch (rollbackError) {
                    rollbackErrors.push(`БД не удалось вернуть автоматически: ${rollbackError.message}`);
                } finally { rmSync(rollbackWork, { recursive: true, force: true }); }
            }
        }
        let remainingPrevious = [];
        let previousMediaReadable = true;
        if (existsSync(previousMedia)) {
            try { remainingPrevious = readdirSync(previousMedia); }
            catch (readError) {
                previousMediaReadable = false;
                rollbackErrors.push(`не удалось проверить содержимое ${previousMedia}: ${readError.message}`);
                recoveryPaths.push(previousMedia);
            }
        }
        if (!previousMediaReadable || restoredOldMedia.size !== oldMediaEntries.length || remainingPrevious.length) {
            if (!rollbackErrors.some((message) => message.includes('media'))) rollbackErrors.push('не все исходные media-файлы подтверждены после возврата');
            recoveryPaths.push(previousMedia);
        } else if (existsSync(previousMedia)) {
            try { rmSync(previousMedia, { recursive: true, force: true }); }
            catch (rollbackError) {
                rollbackErrors.push(`не удалось удалить пустой каталог media ${previousMedia}: ${rollbackError.message}`);
                recoveryPaths.push(previousMedia);
            }
        }
        if (existsSync(stagedMedia)) {
            try {
                if (readdirSync(stagedMedia).length && rollbackErrors.length) {
                    recoveryPaths.push(stagedMedia);
                    preserveStagedMedia = true;
                }
            } catch (readError) {
                rollbackErrors.push(`не удалось проверить содержимое ${stagedMedia}: ${readError.message}`);
                recoveryPaths.push(stagedMedia);
                preserveStagedMedia = true;
            }
        }
        const retainedPaths = [...new Set(recoveryPaths.filter((path) => existsSync(path)))];
        const detail = rollbackErrors.length ? ` Ошибки отката: ${rollbackErrors.join('; ')}.` : '';
        const appState = appStopped ? 'Приложение оставлено остановленным.' : 'Состояние приложения не менялось.';
        const manualRecovery = retainedPaths.length
            ? ` Требуется ручное восстановление. Данные сохранены по путям: ${retainedPaths.join(', ')}.`
            : '';
        console.error(`Восстановление не завершено. ${appState} Резервная копия текущего состояния: ${before && existsSync(before) ? before : 'не создана'}.${detail}${manualRecovery}`);
        throw error;
    } finally {
        if (!preserveStagedMedia) {
            try { rmSync(stagedMedia, { recursive: true, force: true }); }
            catch (cleanupError) { console.error(`Временные media-файлы остались в ${stagedMedia}: ${cleanupError.message}`); }
        }
        rmSync(work, { recursive: true, force: true });
    }
}

function safeName(name) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.tar\.gz$/.test(name) || name.includes('..')) fail('Недопустимое имя архива.');
    return name;
}

async function pull(name) {
    const host = getRemoteHost();
    const list = (await output('ssh', [host, "sudo -n -u kroy /usr/local/sbin/kroy-run backup list"])).toString().trim().split('\n').filter(Boolean);
    const selected = name === 'latest' ? list.at(-1) : safeName(name);
    if (!selected || !list.includes(selected)) fail(`Удалённый архив не найден: ${name}`);
    const destination = join(BACKUPS, safeName(selected));
    if (existsSync(destination)) fail(`Файл уже существует: ${destination}`);
    mkdirSync(BACKUPS, { recursive: true, mode: 0o700 });
    chmodSync(BACKUPS, 0o700);
    const temp = `${destination}.partial-${randomUUID()}`;
    try {
        const child = spawn('ssh', [host, `sudo -n -u kroy /usr/local/sbin/kroy-run backup stream ${selected}`], { stdio: ['ignore', 'pipe', 'inherit'] });
        const transfer = pipeline(child.stdout, createWriteStream(temp, { mode: 0o600, flags: 'wx' }));
        const code = await new Promise((resolvePromise, reject) => { child.once('error', reject); child.once('exit', resolvePromise); });
        await transfer;
        if (code !== 0) fail(`Передача архива завершилась с кодом ${code ?? 1}`);
        chmodSync(temp, 0o600);
        await validateOnly(temp);
        renameSync(temp, destination);
        console.log(`Архив загружен: ${destination}`);
    } finally { rmSync(temp, { force: true }); }
}

async function push(archive) {
    const host = getRemoteHost();
    const resolved = resolve(archive);
    if (!existsSync(resolved)) fail(`Архив не найден: ${resolved}`);
    const name = safeName(basename(resolved));
    await validateOnly(resolved);
    const child = spawn('ssh', [host, `sudo -n -u kroy /usr/local/sbin/kroy-run backup receive ${name}`], { stdio: ['pipe', 'inherit', 'inherit'] });
    const exited = new Promise((resolvePromise, reject) => {
        child.once('error', reject);
        child.once('exit', resolvePromise);
    });
    const [code] = await Promise.all([exited, pipeline(createReadStream(resolved), child.stdin)]);
    if (code !== 0) fail(`Загрузка завершилась с кодом ${code ?? 1}`);
    console.log(`Архив передан на VPS: ${name}`);
}

async function internal(action, value) {
    if (action === 'list') {
        if (existsSync(BACKUPS)) {
            const archives = readdirSync(BACKUPS)
                .filter((name) => name.endsWith('.tar.gz'))
                .map((name) => ({ name, modifiedAt: statSync(join(BACKUPS, name)).mtimeMs }));
            archives.sort((left, right) => left.modifiedAt - right.modifiedAt || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
            console.log(archives.map(({ name }) => name).join('\n'));
        }
        return;
    }
    if (action === 'stream') {
        const path = join(BACKUPS, safeName(value));
        if (!existsSync(path)) fail('Архив не найден.');
        await pipeline(createReadStream(path), process.stdout);
        return;
    }
    if (action === 'receive') {
        const name = safeName(value);
        mkdirSync(BACKUPS, { recursive: true, mode: 0o700 });
        chmodSync(BACKUPS, 0o700);
        const destination = join(BACKUPS, name);
        if (existsSync(destination)) fail(`Файл уже существует: ${name}`);
        const temp = join(BACKUPS, `.${name}.partial-${randomUUID()}`);
        const file = createWriteStream(temp, { mode: 0o600, flags: 'wx' });
        try {
            await pipeline(process.stdin, file);
            await validateOnly(temp);
            if (existsSync(destination)) fail(`Файл уже существует: ${name}`);
            renameSync(temp, destination);
        } finally { rmSync(temp, { force: true }); }
        return;
    }
    fail('Неизвестная внутренняя команда backup.');
}

try {
    if (command === 'create') {
        let destination = join(BACKUPS, `kroy-${new Date().toISOString().replaceAll(':', '-')}.tar.gz`);
        if (rest.length) {
            if (rest.length !== 2 || rest[0] !== '--output') fail('Использование: bun run backup create [--output <путь>].');
            destination = resolve(rest[1]);
        }
        await createArchive(destination);
    } else if (command === 'restore') {
        if (rest.length !== 1) fail('Использование: bun run backup restore <архив>.');
        await restoreArchive(rest[0]);
    } else if (command === 'pull') {
        if (rest.length !== 1) fail('Использование: bun run backup pull <имя|latest>.');
        await pull(rest[0]);
    } else if (command === 'push') {
        if (rest.length !== 1) fail('Использование: bun run backup push <архив>.');
        await push(rest[0]);
    } else if (command === 'list' || command === 'stream' || command === 'receive') {
        await internal(command, rest[0]);
    } else fail('Использование: bun run backup create|restore|pull|push ...');
} catch (error) {
    console.error(`Ошибка backup: ${error.message}`);
    process.exitCode = 1;
}
