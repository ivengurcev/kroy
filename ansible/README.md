# Kroy Nginx на VPS

Ansible-шаблоны запускают один отдельный экземпляр установленного системного
Nginx от пользователя приложения. Системный Nginx остаётся владельцем HTTPS и
проксирует домены Oysite на `127.0.0.1:8080`.

Перед применением задайте `kroy_root`, `kroy_user`, при необходимости
`kroy_group`, и `kroy_domains` в inventory или через `-e`. Playbook идемпотентно
создаёт системную группу, пользователя без интерактивного shell, рабочий
каталог и runtime-каталоги с правильным владельцем. Пользователь SSH-подключения
добавляется в группу Kroy, а каталоги получают setgid и права `2770`, поэтому
переданные им файлы наследуют группу `kroy` и доступны сборщику `kroy`.
Существующий пользователь и каталоги не пересоздаются и не удаляются.

Bootstrap устанавливает системные зависимости: Nginx, PostgreSQL, `rsync`,
`acl`, `python3-psycopg2` и строго Node.js `24.19.0` из NodeSource. При наличии
Node.js 22 или другой версии пакет обновляется до этой точной версии; после
установки выполняется проверка `node --version`.

Playbook не перезаписывает основной `nginx.conf`; он добавляет отдельный файл в
`conf.d` и systemd unit Kroy.
TLS-сертификаты намеренно не настраиваются.

Для первоначального выпуска сертификата `oysite.ru` и `*.oysite.ru` используйте
отдельный playbook после настройки DNS-записи `_acme-challenge.oysite.ru`:

```bash
ansible-playbook -i inventory ansible/kroy-https.yml \
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
ansible-galaxy collection install -r ansible/requirements.yml
```

Bootstrap не изменяет конфигурации Nginx и PostgreSQL и не затрагивает другие
приложения сервера. Для Node.js `24.19.0` включается Corepack с Yarn-shim в
`/usr/local/bin/yarn`; Yarn выбирает версию из `packageManager` проекта.
Пользователь берётся из настроек Ansible, inventory или `~/.ssh/config`.
После bootstrap переподключитесь по SSH, чтобы обновилось членство в
группе. Отдельный sudoers или привилегированный помощник
Kroy не добавляется.

Для первоначальной настройки сервера, PostgreSQL и `.env` выполните bootstrap:

```bash
ansible-playbook -i inventory ansible/kroy-bootstrap.yml \
  -e kroy_root=/srv/kroy \
  -e kroy_user=kroy
```

После bootstrap выполните первый deploy приложения из локального checkout Kroy:

```bash
ansible-playbook -i inventory ansible/kroy-deploy.yml \
  -e kroy_root=/srv/kroy \
  -e kroy_user=kroy \
  -e 'kroy_domains=["example.oysite.ru"]'
```

Затем один раз настройте отдельный Kroy Nginx и системный reverse proxy:

```bash
ansible-playbook -i inventory ansible/kroy-nginx.yml \
  -e kroy_root=/srv/kroy \
  -e kroy_user=kroy
```

Provision создаёт роль PostgreSQL `kroy` с `LOGIN`, базу `kroy` и файл
`/srv/kroy/.env` с правами `0600`. Пароль базы и `AUTH_SECRET` генерируются
только при первом запуске. Существующий `.env` не перезаписывается; если роль
базы отсутствует, она восстанавливается с паролем из этого файла.

`kroy-deploy.yml` не импортирует bootstrap или provision и не устанавливает
системные пакеты, пользователей или PostgreSQL. При несовпадении Node.js deploy
завершается с рекомендацией повторно запустить bootstrap. Yarn release не
проверяется отдельной удалённой задачей: необходимые PnP-артефакты проверяются
локально перед rsync. `kroy-provision.yml` сохранён как совместимая точка входа
и просто вызывает bootstrap.

Перед deploy на локальной машине выполняются `yarn set version 4.18.1 --yarn-path`,
настройка `enableGlobalCache: false`, затем `yarn install --immutable` и
`yarn vyaz:build`. В rsync передаются `.pnp.cjs`, `.pnp.loader.mjs`,
`.yarn/cache`, `.yarn/unplugged`, `.yarn/releases` и конфигурация Yarn, а также
сборка `dist`. Перед синхронизацией их наличие проверяется. Данные передаются
напрямую от пользователя SSH-подключения. Исключаются `.git`
(в том числе внутри субмодулей), `.env`, `dist/sites`, конфигурации
`dist/kroy/nginx`, `data/`, локальные `node_modules`, логи и `ansible/`.
`--delete` и `--chown` не используются: серверные данные и конфигурации
сохраняются. На VPS `yarn install` и `vyaz:build` не запускаются; миграции
используют переданный release Yarn через `/usr/bin/node` и зависимости без
обращения к реестру пакетов.

После bootstrap systemd-unit `kroy-app` уже подготовлен. Deploy выполняет
`yarn db:migrate` от имени пользователя `kroy`, запускает приложение и
перезапускает его только при изменениях.

После первого применения проверьте сервис:

```bash
systemctl status kroy-app kroy-nginx
systemctl is-enabled kroy-app kroy-nginx
```

После deploy приложения публикация отдельного сайта выполняется локально одной
командой:

```bash
yarn site:deploy demo
```

Команда подключается по SSH-алиасу `enduro-koltushi.ru`. На VPS защищённый
скрипт сначала запускает существующие `site:build`, затем `site:publish` от
пользователя `kroy`; при ошибке сборки публикация не запускается. Sudo разрешён
только для этого скрипта и только без запроса пароля.
