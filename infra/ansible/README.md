# Kroy Nginx на VPS

Ansible-шаблоны запускают один отдельный экземпляр установленного системного
Nginx от пользователя приложения. Системный Nginx остаётся владельцем HTTPS и
проксирует домены Oysite на `127.0.0.1:8080`.

Хост задаётся переменной `KROY_REMOTE_HOST`; файл `inventory` — исполняемый
скрипт, который читает её для Ansible. Без переменной inventory завершается
ошибкой.

Перед применением задайте `kroy_root`, `kroy_user`, при необходимости
`kroy_group`, и `kroy_domains` через `-e`. Playbook идемпотентно
создаёт системную группу, пользователя без интерактивного shell, рабочий
каталог и runtime-каталоги с правильным владельцем. Пользователь SSH-подключения
добавляется в группу Kroy, а каталоги получают setgid и права `2770`, поэтому
переданные им файлы наследуют группу `kroy` и доступны сборщику `kroy`.
Существующий пользователь и каталоги не пересоздаются и не удаляются.

Bootstrap устанавливает системные зависимости: Nginx, PostgreSQL, `rsync`,
`acl`, `python3-debian`, `python3-psycopg2` и строго Node.js `24.19.0` из
NodeSource. Репозиторий NodeSource настраивается в формате deb822
(`/etc/apt/sources.list.d/nodesource.sources`), а legacy `nodesource.list`
удаляется. При наличии Node.js 22 или другой версии пакет обновляется до этой
точной версии; после установки выполняется проверка `node --version`.

Playbook не перезаписывает основной `nginx.conf`; он добавляет отдельный файл в
`conf.d` и systemd unit Kroy.
TLS-сертификаты намеренно не настраиваются.

Для первоначального выпуска сертификата `oysite.ru` и `*.oysite.ru` используйте
отдельный playbook после настройки DNS-записи `_acme-challenge.oysite.ru`:

```bash
ansible-playbook -i infra/ansible/inventory infra/ansible/kroy-https.yml \
  -e acme_dns_credentials_path="$HOME/.config/kroy/acme-dns.json"
```

Certbot использует существующий аккаунт Let's Encrypt без обязательного email.
Учётные данные acme-dns передаются только во время этого запуска, сохраняются
на VPS с правами `0600` и не выводятся в лог. Обычный deploy не требует
локального файла секретов. После успешного выпуска подключается HTTPS и HTTP
начинает перенаправляться на HTTPS. Certbot использует deploy-hook:
конфигурация системного Nginx проверяется через `nginx -t` и затем
перезагружается. Существующий Certbot timer выполняет автоматическое продление.
До получения сертификата HTTPS-конфигурация не включается.

Локально нужны Ansible с коллекциями `ansible.posix` и `community.postgresql`,
SSH-доступ и `rsync`. Установите коллекции:

```bash
ansible-galaxy collection install -r infra/ansible/requirements.yml
```

Bootstrap не изменяет конфигурации Nginx и PostgreSQL и не затрагивает другие
приложения сервера. Для Node.js `24.19.0` включается Corepack с Yarn-shim в
`/usr/local/bin/yarn`; Yarn выбирает версию из `packageManager` проекта.
Пользователь берётся из настроек Ansible, inventory или `~/.ssh/config`.
После bootstrap переподключитесь по SSH, чтобы обновилось членство в
группе. Bootstrap устанавливает защищённый запускатель
`/usr/local/sbin/kroy-run` и узкое правило sudoers, разрешающее SSH-пользователю
запускать только скрипты Kroy от имени `kroy`. Отдельное правило разрешает
без пароля только `start`/`restart` для `kroy-app` и `reload` для `kroy-nginx`.
Изменения этих правил применяются повторным запуском bootstrap с sudo-паролем;
в обычном `yarn deploy app` пароль не требуется.

## Runtime: Node.js и Bun

По умолчанию приложение работает под Node.js `24.19.0` и Yarn PnP. Для запуска
HTTP-сервера под Bun укажите `kroy_runtime=bun` при bootstrap и deploy. Bun
`1.4.4` ставится из закреплённого Linux x64 baseline archive в
`/usr/local/bin/bun`; bootstrap разрешает режим только на Ubuntu 24.04 x86_64.
Node.js и Yarn остаются установленными для сборки, Yarn-команд и rollback.

```bash
ansible-playbook -i infra/ansible/inventory infra/ansible/kroy-bootstrap.yml \
  -e kroy_runtime=bun
ansible-playbook -i infra/ansible/inventory infra/ansible/kroy-deploy.yml \
  -e kroy_runtime=bun
```

Локальная установка и `yarn vyaz:build` выполняются в основном Yarn PnP
checkout. `.yarnrc.yml` не переключается. На VPS защищённый
`/usr/local/sbin/kroy-run deps:install` задаёт `YARN_NODE_LINKER=pnpm` и
`YARN_GLOBAL_FOLDER=/srv/kroy/.yarn/global`, проверяет фактические `nodeLinker`
и `globalFolder`, затем выполняет `yarn install --immutable` от пользователя
`kroy`. Global folder находится на том же filesystem, что и проект. После установки
`runtime:verify` проверяет импорт `@vyaz/core/createApp.mjs` выбранным runtime.
Deploy применяет миграции и перезапускает службу после завершения шагов
установки и проверки runtime.

Systemd запускает Bun напрямую как `bun --no-install server.mjs --serve`.
Пакетные скрипты и Yarn остаются под Node.js: `kroy-run` работает на Node, а
сборка выполняется локально. Публикация из `scripts/publishSite.mjs` порождает
дочерние процессы через `process.execPath`, то есть при вызове из Bun — Bun.
Административный API также запускает Yarn release через `process.execPath`.
Совместимость этих цепочек с Bun не проверена, поэтому Bun здесь пока
предназначен для HTTP-сервера; publication следует выполнять Yarn-командами под
Node до отдельного runtime-тестирования.

Для rollback переключите systemd тем же bootstrap с `kroy_runtime=node`, затем
выполните deploy с тем же значением:

```bash
ansible-playbook -i infra/ansible/inventory infra/ansible/kroy-bootstrap.yml \
  -e kroy_runtime=node
ansible-playbook -i infra/ansible/inventory infra/ansible/kroy-deploy.yml \
  -e kroy_runtime=node
```

Синхронизированные `.pnp.cjs`, `.pnp.loader.mjs` и Yarn cache остаются для Node
PnP. Bun install добавляет `node_modules`; rollback его не удаляет и не меняет
данные приложения. Не запускайте Node и Bun одновременно на одной копии сервера.

Для первоначальной настройки сервера, PostgreSQL и `.env` выполните bootstrap:

```bash
ansible-playbook -i infra/ansible/inventory infra/ansible/kroy-bootstrap.yml \
  -e kroy_root=/srv/kroy \
  -e kroy_user=kroy
```

После bootstrap выполните первый deploy приложения из локального checkout Kroy:

```bash
export KROY_REMOTE_HOST=user@example.org
yarn deploy app
```

Эквивалентный прямой вызов Ansible:

```bash
ansible-playbook -i infra/ansible/inventory infra/ansible/kroy-deploy.yml \
  -e kroy_root=/srv/kroy \
  -e kroy_user=kroy \
  -e 'kroy_domains=["example.oysite.ru"]'
```

Затем один раз настройте отдельный Kroy Nginx и системный reverse proxy:

```bash
ansible-playbook -i infra/ansible/inventory infra/ansible/kroy-nginx.yml \
  -e kroy_root=/srv/kroy \
  -e kroy_user=kroy
```

Provision создаёт роль PostgreSQL `kroy` с `LOGIN`, базу `kroy` и файл
`/srv/kroy/.env` с правами `0600`. Пароль базы и `AUTH_SECRET` генерируются
только при первом запуске. Существующий `.env` не перезаписывается; если роль
базы отсутствует, она восстанавливается с паролем из этого файла.

`kroy-deploy.yml` не импортирует bootstrap или provision и не устанавливает
системные пакеты, пользователей или PostgreSQL. При несовпадении Node.js либо
выбранного Bun deploy завершается с рекомендацией повторно запустить bootstrap.
Yarn release не
проверяется отдельной удалённой задачей: необходимые PnP-артефакты проверяются
локально перед rsync. `kroy-provision.yml` сохранён как совместимая точка входа
и просто вызывает bootstrap.

Перед deploy на локальной машине выполняются `yarn install --immutable` и
`yarn vyaz:build`. Версия Yarn и `enableGlobalCache: false` уже зафиксированы
в репозитории. В rsync передаются `.pnp.cjs`, `.pnp.loader.mjs`,
`.yarn/cache`, `.yarn/unplugged`, `.yarn/releases` и конфигурация Yarn, а также
сборка `dist`. Перед синхронизацией их наличие проверяется. Данные передаются
напрямую от пользователя SSH-подключения. Исключаются `.git`
(в том числе внутри субмодулей), `.env`, `dist/sites`, конфигурации
`dist/kroy/nginx`, `data/`, локальные `node_modules`, логи и `infra/ansible/`.
`--delete` и `--chown` не используются: серверные данные и конфигурации
сохраняются. В режиме Node на VPS `yarn install` и `vyaz:build` не запускаются;
миграции используют переданный release Yarn через `/usr/bin/node` и PnP-
зависимости. В режиме Bun deploy выполняет immutable Yarn install с pnpm linker
перед миграциями; lockfile и основная PnP-конфигурация не меняются.

После bootstrap systemd-unit `kroy-app` уже подготовлен под выбранный runtime.
Deploy проверяет импорт Vyaz, выполняет `yarn db:migrate` через защищённый
запускатель от имени `kroy`, затем перезапускает приложение и проверяет
активное состояние сервиса.

После первого применения проверьте сервис:

```bash
systemctl status kroy-app kroy-nginx
systemctl is-enabled kroy-app kroy-nginx
```

После deploy приложения публикация отдельного сайта выполняется локально одной
командой:

```bash
yarn deploy site demo
```

Команда использует `KROY_REMOTE_HOST`. На VPS защищённый запускатель выполняет
единый `site:publish` от пользователя `kroy`; команда сама собирает и публикует
сайт, а при ошибке сборки переключение релиза не начинается. Sudo разрешён
только для запускателя и только без запроса пароля.
