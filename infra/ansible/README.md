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
`acl`, `python3-psycopg2`, `unzip` и Bun `1.4.4`. Bun загружается из закреплённого
Linux x64 baseline archive с проверкой SHA-256 и устанавливается в
`/usr/local/bin/bun`. Проверяется Ubuntu 24.04 x86_64. Playbook не устанавливает
Node.js, NodeSource, Corepack или Yarn.

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
приложения сервера. Пользователь берётся из настроек Ansible, inventory или
`~/.ssh/config`. После bootstrap переподключитесь по SSH, чтобы обновилось
членство в группе. Bootstrap устанавливает защищённый запускатель
`/usr/local/sbin/kroy-run` и узкое правило sudoers, разрешающее SSH-пользователю
запускать только скрипты Kroy от имени `kroy`. Отдельное правило разрешает
без пароля только `start`/`restart` для `kroy-app` и `reload` для `kroy-nginx`.
Изменения этих правил применяются повторным запуском bootstrap с sudo-паролем;
в обычном `bun run deploy app` пароль не требуется.

Только Bun можно установить отдельно, не запуская остальную настройку сервера:

```bash
ansible-playbook -i infra/ansible/inventory infra/ansible/kroy-bootstrap.yml \
  --tags bun-install
```

Обычный bootstrap устанавливает Bun, системные пакеты, пользователя и службы.
Systemd запускает приложение командой `bun --no-install server.mjs --serve`,
а `kroy-nginx.service` подготавливает конфигурацию через Bun `ExecStartPre`.
Защищённый runner тоже работает на Bun: он ограничивает набор команд файлами
`package.json`, запускает скрипты через `bun run` и проверяет импорт Vyaz.

В Ansible deploy сначала локально выполняются `bun install --frozen-lockfile`
и `bun run vyaz:build`. После передачи файлов на VPS зависимости устанавливаются
повторно от пользователя `kroy` с той же замороженной Bun lockfile; затем
проверяется импорт `@vyaz/core/createApp.mjs`, применяются миграции и служба
перезапускается. Публикация из `scripts/publishSite.mjs` и административного API
запускает дочерние Bun-процессы через `process.execPath`; эти цепочки успешно
прошли Bun-тестирование на этапе 2.

Для первоначальной настройки сервера, PostgreSQL и `.env` выполните bootstrap:

```bash
ansible-playbook -i infra/ansible/inventory infra/ansible/kroy-bootstrap.yml \
  -e kroy_root=/srv/kroy \
  -e kroy_user=kroy
```

После bootstrap выполните первый deploy приложения из локального checkout Kroy:

```bash
export KROY_REMOTE_HOST=user@example.org
bun run deploy app
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
системные пакеты, пользователей или PostgreSQL. При отсутствии Bun `1.4.4` deploy
завершается с рекомендацией запустить bootstrap. `kroy-provision.yml` сохранён
как совместимая точка входа и вызывает bootstrap.

Перед deploy на локальной машине выполняются `bun install --frozen-lockfile` и
`bun run vyaz:build`; проверяются Bun `1.4.4`, `package.json` и `bun.lock`.
Через rsync передаются исходники и сборка `dist`. Данные передаются напрямую от
пользователя SSH-подключения. Исключаются `.git`
(в том числе внутри субмодулей), `.env`, `dist/sites`, конфигурации
`dist/kroy/nginx`, `data/`, все локальные `node_modules`, логи и `infra/ansible/`.
`--delete` и `--chown` не используются: серверные данные и конфигурации
сохраняются. На VPS защищённый runner от имени `kroy` выполняет
`bun install --frozen-lockfile` до миграций. Существующие `.env`, PostgreSQL
данные, опубликованные релизы, медиа и Nginx-конфиги остаются вне синхронизации.

После bootstrap systemd-units `kroy-app` и `kroy-nginx` подготовлены для Bun.
Deploy проверяет импорт Vyaz, выполняет `bun run db:migrate` через защищённый
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
bun run deploy site demo
```

Команда использует `KROY_REMOTE_HOST`. На VPS защищённый запускатель выполняет
единый `site:publish` от пользователя `kroy`; команда сама собирает и публикует
сайт, а при ошибке сборки переключение релиза не начинается. Sudo разрешён
только для запускателя и только без запроса пароля.
