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
docker compose -f infra/compose.yaml exec app yarn db:seed
docker compose -f infra/compose.yaml exec app yarn user:create admin@example.org --superadmin
docker compose -f infra/compose.yaml exec app yarn site:publish demo
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
yarn dev:restart app     # также: nginx или db
yarn dev:rebuild app     # пересобрать и пересоздать только выбранный сервис
yarn dev:app             # старый watch-сервер Vyaz на хосте, без Compose
```

Не используйте `docker compose down --volumes`, если нужно сохранить
контейнерную БД. Автозапуск после перезагрузки хоста отключён.

## Публикация и rollback

`yarn site:build <slug>` только готовит staging. `yarn site:publish <slug>`
выполняет полную сборку и публикацию; эту же команду вызывает административный
API и `yarn deploy site <slug>`. PostgreSQL advisory lock не позволяет CLI и
API публиковать одновременно.

Алгоритм одинаков в development и production: staging, неизменяемый release-id,
версионирование ресурсов, переключение Nginx, пять сохранённых релизов и
восстановление прежней конфигурации при ошибке. Откат выполняется так:

```bash
docker compose -f infra/compose.yaml exec app yarn site:releases demo
docker compose -f infra/compose.yaml exec app yarn site:rollback demo <release-id>
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

Полезны также `yarn dev:status`, `yarn dev:logs` и логи
`dist/kroy/nginx-dev/logs/error.log`. Публикация вызывает reload процесса Nginx, а
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

Production остаётся без Docker: системный PostgreSQL, Node.js 24.19.0, Yarn
4.18.1 PnP, отдельный Kroy Nginx под systemd и внешний системный Nginx.
Provisioning/deploy находятся в `infra/ansible`; inventory —
`infra/ansible/inventory`. Начальная команда:

```bash
ansible-playbook -i infra/ansible/inventory \
  infra/ansible/kroy-bootstrap.yml -K
```

Compose не предназначен для VPS и не управляет production-сервисами. Полная
проверка systemd, rsync и playbook требует целевого VPS; локальная разработка
их не запускает.
