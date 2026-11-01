# Development и production-инфраструктура Kroy

## Первый запуск development

Нужны Docker с Compose plugin и Yarn 4. Команда из корня проекта собирает
контейнеры, создаёт отдельный volume PostgreSQL, применяет миграции и показывает
общий поток логов:

```bash
yarn dev
```

Открывайте Kroy через `http://demo.localhost:8080`. Приложение и PostgreSQL не
публикуют порты на хост; `127.0.0.1:8080` принадлежит только контейнеру Nginx
Kroy. Системные PostgreSQL и Nginx не используются и не изменяются.

На пустой базе один раз создайте демонстрационные данные, администратора и
первый релиз из другого терминала:

```bash
yarn dev:run db:seed
yarn dev:run user:create admin@example.org --superadmin
yarn dev:run site:publish demo
```

`db:seed` и `user:create` интерактивны. При следующих запусках миграции
применяются повторно безопасно, но seed автоматически не выполняется. Данные БД
остаются в именованном volume, релизы — в `dist/sites`, медиа — в `data/media`.

## Команды

```bash
yarn dev                 # foreground и логи всех сервисов; Ctrl+C остановит их
yarn dev:bg              # запуск в фоне
yarn dev:down            # удалить контейнеры и сеть, сохранить данные
yarn dev:logs            # следить за логами
yarn dev:status          # показать состояние сервисов
yarn dev:run <script> [...args] # выполнить Yarn-скрипт внутри app
yarn dev:restart app     # также: nginx или db
yarn dev:rebuild app     # пересобрать и пересоздать только выбранный сервис
```

CLI-команды и утилиты остаются в `scripts/`; реализация сборки, реестров,
публикации и генерации Nginx находится в `build/`. Пользовательские команды
ниже сохраняют прежние имена и аргументы.

Команды Kroy для development выполняются через контейнер `app` и сохраняют
интерактивный терминал и код завершения:

```bash
yarn dev:run user:create admin@example.org --superadmin
yarn dev:run site:publish demo
yarn dev:run db:status
yarn dev:run site:rollback demo 20261028143003031
```

Не используйте `docker compose down --volumes`, если нужно сохранить
контейнерную БД. Автозапуск после перезагрузки хоста отключён.

## Публикация и rollback

`yarn site:build <slug>` только готовит staging. `yarn site:publish <slug>`
выполняет полную сборку и публикацию; эту же команду вызывает административный
API и `yarn deploy site <slug>`. Общий PostgreSQL advisory lock не позволяет
одновременно выполнять publish и rollback.

Алгоритм одинаков в development и production: staging, неизменяемый release-id,
версионирование ресурсов, переключение Nginx, пять сохранённых релизов и
восстановление прежней конфигурации при ошибке. Откат выполняется так:

```bash
yarn dev:run site:releases demo
yarn dev:run site:rollback demo <release-id>
```

## Диагностика Nginx

Nginx и приложение видят `dist/sites` и отдельный development-каталог
`dist/kroy/nginx-dev` по одинаковым абсолютным путям `/app/dist/...`. Это не
даёт Compose подхватить production-конфиги с другими путями и upstream.
Управляющий HTTP-адаптер доступен только в
сети Compose и принимает только фиксированные операции validate/reload. Docker
socket не монтируется.

Проверить текущий сгенерированный конфиг вручную:

```bash
docker compose -f infra/compose.yaml exec -T nginx \
  nginx -t -c /app/dist/kroy/nginx-dev/nginx.conf
```

Полезны также `yarn dev:status` и `yarn dev:logs`: development error/access log
Nginx выводятся в stderr/stdout Compose. Публикация вызывает reload процесса Nginx, а
не перезапуск контейнера.

## Перенос существующей локальной PostgreSQL

Сначала сделайте dump хостовой базы; команда только читает её:

```bash
pg_dump --format=custom --no-owner --no-acl \
  --dbname='postgres://kroy@127.0.0.1:5432/kroy' \
  --file=/tmp/kroy.dump
```

Затем поднимите только контейнерную БД и восстановите dump. `--clean` очищает
только базу внутри volume Kroy, поэтому перед командой убедитесь, что указано
имя Compose-проекта `kroy-dev` и файл `infra/compose.yaml`:

```bash
docker compose -f infra/compose.yaml up -d db
docker compose -f infra/compose.yaml exec -T db \
  pg_restore --clean --if-exists --no-owner --no-acl -U kroy -d kroy \
  < /tmp/kroy.dump
yarn dev
```

Хостовую PostgreSQL не останавливайте и не удаляйте, пока не проверите данные
через Kroy. Для plain SQL используйте `pg_dump --format=plain` и `psql -U kroy
-d kroy` вместо `pg_restore`.

## Production

Production остаётся без Docker: системный PostgreSQL, Yarn 4.18.1, отдельный
Kroy Nginx под systemd и внешний системный Nginx. Runtime по умолчанию — Node.js
24.19.0 с Yarn PnP; на подготовленном Bun-хосте можно выбрать Bun 1.4.4,
оставив Node.js/Yarn для управления зависимостями и rollback.
Provisioning/deploy находятся в `infra/ansible`; inventory —
`infra/ansible/inventory`. Начальная команда:

```bash
ansible-playbook -i infra/ansible/inventory \
  infra/ansible/kroy-bootstrap.yml -K
```

Compose не предназначен для VPS и не управляет production-сервисами. Полная
проверка systemd, rsync и playbook требует целевого VPS; локальная разработка
их не запускает.

Runtime выбирается явно при bootstrap и deploy. В режиме Bun Yarn использует
`nodeLinker: pnpm` только для VPS install, а systemd запускает `server.mjs`
напрямую с `bun --no-install`; основной `.yarnrc.yml` остаётся PnP. Возврат к
Node выполняется повторными bootstrap и deploy с `-e kroy_runtime=node`.
Синхронизированные PnP-файлы сохраняются, данные и `node_modules` не удаляются.
Подробности — в [Ansible-инструкции](ansible/README.md#runtime-nodejs-и-bun).


## Standalone-команды и окружение

Прямые `yarn build`, `yarn serve`, команды БД и `yarn site:*` используют
standalone/production-окружение. Для development выполняйте их через
`yarn dev:run <script> [...args]`; `yarn demo` — алиас только подготовки demo.
Полный список — `yarn kroy:help` (встроенный `yarn help` принадлежит Yarn).

Для ручного standalone-окружения с установленными PostgreSQL, Node.js и Yarn:

```bash
cp .env.example .env
createuser --pwprompt --createdb kroy
createdb -O kroy kroy
yarn install --immutable
```

Настройте DATABASE_URL и случайный AUTH_SECRET (не менее 32 случайных байт)
в .env; для платежей нужен платформенный PRODAMUS_SYS, см.
[prodamus.md](../docs/prodamus.md). Не перезаписывайте существующий .env.
Команды миграций и запуска:

```bash
yarn db:migrate
yarn db:status
yarn user:create admin@example.org --superadmin
yarn build
yarn serve
```

`user:create` запрашивает пароль скрыто; не передавайте его аргументом.
`db:rollback` и `db:seed` требуют подтверждения в интерактивном терминале.
Вход — /auth/signin на том же домене, где открыт /admin; выход — /auth/signout.
Доступ имеют активный superadmin и назначенный admin текущего сайта;
заблокированный пользователь не допускается. Назначение существующего пользователя:

```bash
yarn site:user:add demo user@example.org
```

Структурные права роли admin шире первоначальных требований к владельцу сайта;
[расхождение](../docs/requirements.md#сайты-и-доступ) ещё требует решения.

## Nginx вне Compose

Эти команды сохранены для standalone-окружения; штатный development запускает
Nginx в Compose. Для отдельного экземпляра Nginx Kroy:

```bash
yarn preview
yarn preview:validate
yarn preview:reload
```

`preview` — алиас preview:start: создаёт базовый конфиг и MIME-таблицу до первого
запуска, проверяет и запускает Nginx; повторный вызов делает reload. По умолчанию
используются dist/kroy/nginx/nginx.conf, каталоги logs/tmp/sites внутри этого
каталога, listen 127.0.0.1:8080 и upstream 127.0.0.1:3000. Переменные
NGINX_CONFIG_DIR, NGINX_SITES_ROOT, NGINX_UPSTREAM и NGINX_LISTEN меняют пути/адреса.
Kroy не вызывает sudo для управления этим процессом.

После перехода со старой схемы удалите прежний системный include
`dist/kroy/nginx/*.conf`: системный Nginx не должен подключать фрагменты
отдельного экземпляра напрямую. В production используйте Ansible/systemd,
а не второй ручной запуск preview поверх работающего сервиса.

site:build меняет только staging; site:publish обновляет конфигурацию и вызывает
validate/reload. Активный релиз определяется конфигурацией, не именем самого
нового каталога. URL ресурсов содержит /_kroy/releases/<release-id>/assets/;
откат на уже активную версию не переключает её повторно и не откатывает БД.
О доменах, зарезервированных путях и кодах ответа — [ROUTING.md](../docs/ROUTING.md).

Для домена без локальной DNS-записи можно обратиться к Nginx так:

```bash
curl --resolve vet.example.test:8080:127.0.0.1 http://vet.example.test:8080/
```

Проверка standalone-конфига:

```bash
nginx -t -c "$PWD/dist/kroy/nginx/nginx.conf"
```

Неизвестный Host получает 404. После изменения доменов или обновления правил
проксирования публикуйте сайт заново; одной подготовки staging недостаточно.
Публичный DNS и TLS собственного домена отдельно этими командами не настраиваются.
Для oysite.ru и *.oysite.ru есть отдельный TLS playbook в
[Ansible-инструкции](ansible/README.md).

## Удалённые команды

```bash
export KROY_REMOTE_HOST=user@example.org
yarn remote db:status
yarn remote site:list
yarn remote user:create user@example.org --superadmin
yarn remote site:user:add demo user@example.org
yarn deploy app
yarn deploy site demo
```

Без KROY_REMOTE_HOST remote/deploy завершаются до подключения и сборки.
Команды выполняются из /srv/kroy от kroy через защищённый запускатель; аргументы
передаются без shell-подстановки, интерактивным командам выделяется TTY.
`deploy app` разворачивает приложение через Ansible, `deploy site` вызывает
site:publish на VPS. Первичная настройка сервера и права sudoers описаны в
[infra/ansible/README.md](ansible/README.md).
