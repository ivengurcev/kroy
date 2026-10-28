# Kroy

Kroy — прототип мультисайтовой платформы для сборки небольших сайтов из переиспользуемых React-компонентов — **запчастей** (*parts*). Редактор работает как SSR-приложение на [Vyaz](https://github.com/ivengurcev/vyaz).

## Текущее состояние

- Vyaz собирает и обслуживает список страниц и редактор в `/admin` домена сайта.
- Генератор обнаруживает запчасти и строит поля редактора из JSDoc.
- Панель показывает страницы текущего сайта, позволяет создавать, изменять и удалять их; редактор загружает выбранную страницу из PostgreSQL, изменяет её структуру и свойства запчастей, показывает живой предпросмотр и сохраняет изменения по кнопке.
- Страница хранится как массив `{ part, props }`; временные `id` остаются только в состоянии редактора.
- PostgreSQL хранит сайты, домены и страницы; API изолирует страницы по домену запроса.
- `yarn site:build <slug>` формирует многостраничный статический сайт из PostgreSQL и общий React-bundle для гидратации его страниц.

Публичные страницы содержат готовый основной контент и отображаются без JavaScript. Сборка подключает общие стили из `layout/site.css`, глобальные CSS-импорты и CSS Modules используемых запчастей в `/assets/app.css`. Импортированные изображения и шрифты получают хешированные имена и также размещаются в `/assets/`. После загрузки общий JavaScript-bundle гидрирует React-разметку, а внутренние переходы выполняет через History API и встроенный реестр страниц, без сетевых запросов. Локальная публикация переключает неизменяемые релизы; production-публикация пока не реализована. Подробности и границы ответственности описаны в [архитектурной документации](docs/ARCHITECTURE.md).

Пользователи и авторизация пока не реализованы.

## Исходные каталоги

| Путь | Назначение |
|---|---|
| `editor/` | Интерфейс и состояние редактора |
| `api/` | Доменно-зависимые обработчики API |
| `db/` | Подключение, seed и миграции PostgreSQL |
| `layout/` | Общие компоненты рендеринга страницы |
| `parts/` | React-запчасти сайта |
| `demo/` | Исходные данные для первоначального заполнения локальной БД |
| `scripts/` | Обнаружение запчастей и статическая генерация |
| `server.mjs` | Конфигурация приложения Vyaz |

Все результаты сборки находятся в `dist/`:

| Путь | Назначение |
|---|---|
| `dist/public/` | Клиентская сборка Vyaz |
| `dist/ssr/` | Серверная сборка Vyaz |
| `dist/kroy/` | Реестры, метаданные и промежуточные файлы Kroy |
| `dist/kroy/staging/<site>/` | Подготовленная, но не опубликованная версия сайта |
| `dist/sites/<site>/` | Готовые статические сайты |

## Справка по командам

Компактная справка доступна непосредственно в терминале:

```bash
yarn kroy:help
```

В Yarn 4 вызов `yarn help` зарезервирован встроенной справкой Yarn. Тот же
скрипт Kroy можно явно запустить как `yarn run help`, но рекомендуемый и
гарантированный вариант — `yarn kroy:help`.

| Назначение | Команды |
|---|---|
| Разработка | `yarn dev`, `yarn dev:bg`, `yarn dev:down`, `yarn dev:logs`, `yarn dev:status` |
| База данных | `yarn db`, `yarn db:seed`, `yarn db:status` |
| Сайты | `yarn site:create <slug> <hostname> [name]`, `yarn site:list`, `yarn site:info <slug>` |
| Домены | `yarn site:domain:add <slug> <hostname>`, `yarn site:domain:remove <slug> <hostname>` |
| Публикация | `yarn site:build <slug>`, `yarn site:publish <slug>`, `yarn site:releases <slug>`, `yarn site:rollback <slug> <release-id>` |
| Удалённое управление | `yarn remote <script> [...args]`, `yarn deploy app`, `yarn deploy site <slug>` |
| Preview | `yarn preview`, `yarn preview:reload`, `yarn preview:validate` |

Быстрые сценарии:

- Development запускается только через Compose; команды базы, сборки и публикации
  выполняются внутри `app` через `docker compose -f infra/compose.yaml exec app`.
- Открыть редактор: `yarn dev` → `http://demo.localhost:8080/admin`.
- Посмотреть публичный сайт: `docker compose -f infra/compose.yaml exec app yarn site:publish <slug>`.
- Опубликовать изменения: `yarn deploy site <slug>`.
- Выполнить команду на VPS: `yarn remote <script> [...args]`.
- Откатить релиз: `yarn site:releases <slug>` →
  `yarn site:rollback <slug> <release-id>`.

## Запчасти

Запчасти обнаруживаются в `parts/`. JSDoc над `export default` задаёт название
(`@kroy-title`), категорию каталога (`@kroy-category`) и редактируемые свойства:
обычные `@param` задают поля, а `@kroy` — виджеты и ограничения.

```jsx
/**
 * @kroy-title Услуги
 * @kroy-category Контент
 *
 * @param {object} props
 * @param {string} props.title - Заголовок секции
 * @kroy title widget=textarea
 */
export default function Services({ title }) {
    return <h2>{title}</h2>;
}
```

На основе описаний Kroy создаёт полный реестр для редактора и сокращённый реестр используемых запчастей для статического сайта. Если название или категория не заданы, для старой запчасти используются название из её идентификатора и категория «Другое».

Идентификаторы имеют вид `@kroy/<kebab-case>`. Имена, выведенные из путей, нормализуются автоматически. Явное `name` из `package.json` имеет приоритет и должно соответствовать тому же формату.

## Запуск development

```bash
yarn dev
```

Compose запускает отдельные PostgreSQL 16, Kroy/Vyaz и Nginx. С хоста доступен
только `http://demo.localhost:8080`; приложение, база и управляющий API Nginx
остаются внутри сети Compose. Первый запуск, команды, перенос существующей БД и
диагностика описаны в [infra/README.md](infra/README.md). Kroy/Vyaz, PostgreSQL
и Nginx в development работают только внутри Compose.

Заполнить локальную БД и собрать оба тестовых сайта:

```bash
docker compose -f infra/compose.yaml exec app yarn db:seed
docker compose -f infra/compose.yaml exec app yarn site:build demo
docker compose -f infra/compose.yaml exec app yarn site:build test
```

`yarn demo` остаётся коротким алиасом сборки `demo`. Команда подготавливает полную версию в `dist/kroy/staging/<slug>/`, включая HTML, ресурсы и `routing.json`, но пока не публикует её в `dist/sites/` и не изменяет конфигурацию Nginx. Предыдущая подготовленная версия сохраняется до успешного завершения новой сборки.

Собрать и опубликовать новую версию:

```bash
docker compose -f infra/compose.yaml exec app yarn site:publish demo
```

`site:publish` сначала заново готовит staging, затем создаёт неизменяемый каталог
`dist/sites/<slug>/<release-id>/`, переключает Nginx вместе с правилами `301/410`
и сохраняет пять последних успешных релизов сайта. Ресурсы доступны по
версионированным URL `/_kroy/releases/<release-id>/assets/`. При ошибке прежний
релиз остаётся активным. Одновременные публикации из CLI и API блокируются в
PostgreSQL.

Посмотреть сохранённые релизы и переключиться на один из них:

```bash
docker compose -f infra/compose.yaml exec app yarn site:releases demo
docker compose -f infra/compose.yaml exec app yarn site:rollback demo 20261017010101439
```

Список отмечает активный релиз по опубликованному Nginx-фрагменту. Откат не копирует и не удаляет релизы, не меняет staging и повторно не переключает уже активную версию.

## Удалённое управление и деплой

Для SSH и Ansible задайте хост в `KROY_REMOTE_HOST`:

```bash
export KROY_REMOTE_HOST=user@example.org
```

Без этой переменной команды `remote` и `deploy` завершаются с ошибкой до сборки и подключения.

Выполнить любой скрипт из `package.json` на VPS:

```bash
yarn remote db:status
yarn remote site:list
yarn remote user:create user@example.org --superadmin
yarn remote site:user:add enduro-koltushi user@example.org
```

Скрипты запускаются из `/srv/kroy` от пользователя `kroy` через защищённый запускатель и узкое правило sudoers. Аргументы передаются без shell-подстановки. Для интерактивных команд вроде `user:create` выделяется TTY, поэтому пароль вводится скрыто.

Развернуть приложение через Ansible или собрать и опубликовать сайт:

```bash
yarn deploy app
yarn deploy site enduro-koltushi
```

`deploy app` использует `infra/ansible/kroy-deploy.yml` и
`infra/ansible/inventory`, читающий `KROY_REMOTE_HOST`. `deploy site` выполняет
единый `site:publish` на VPS; при ошибке сборки переключение релиза не
начинается. Команды `db:rollback` и `db:seed` запрашивают явное подтверждение.

Создать новый сайт с пустой главной страницей и собрать его:

```bash
yarn site:create vet vet.example.test "Семейный ветеринар"
yarn site:build vet
```

Название необязательно и по умолчанию равно slug. Команда создания отклоняет занятые slug и домены и не изменяет существующие данные. Hostname должен быть записан строчными буквами без схемы, порта, пути, wildcard и завершающей точки; конкретная доменная зона не требуется.

Посмотреть список сайтов или подробную информацию об одном сайте:

```bash
yarn site:list
yarn site:info demo
```

Добавить или удалить дополнительный домен сайта:

```bash
yarn site:domain:add demo second-demo.localhost
yarn site:build demo

yarn site:domain:remove demo second-demo.localhost
yarn site:build demo
```

Последний домен сайта удалить нельзя. После изменения доменов можно подготовить новую версию сайта; переключение опубликованной версии и конфигурации preview будет реализовано отдельно.

## Локальный HTTP-preview

Локальный просмотр готового сайта через отдельный экземпляр Nginx Kroy:

```bash
yarn preview
```

Команда создаёт базовый конфиг и MIME-таблицу до первого запуска, затем
проверяет его и запускает Nginx Kroy. Повторный вызов только делает reload уже
запущенного процесса:

```bash
yarn preview:start
yarn preview:validate
```

После перехода с прежней схемы обязательно удалите старый системный `include`
`dist/kroy/nginx/*.conf` из конфигурации системного Nginx. Новый экземпляр
читает только собственный `dist/kroy/nginx/nginx.conf`; системный Nginx не
должен подключать его фрагменты напрямую.

Kroy генерирует собственный `nginx.conf`, PID, логи, временные каталоги и
`sites/*.conf` в `dist/kroy/nginx`. Экземпляр запускается тем же бинарником
Nginx от текущего пользователя и слушает `127.0.0.1:8080`; системный Nginx
для локальной проверки не нужен. При необходимости задайте `NGINX_CONFIG_DIR`,
`NGINX_SITES_ROOT` и `NGINX_UPSTREAM` в `.env`.

Сайты доступны на доменах из таблицы `domains`. `site:build` только
подготавливает версию, а `site:publish` выполняет сборку, переключает Kroy Nginx
на новый релиз и проверяет/перезагружает только его конфигурацию. Порт, upstream
и корень сайтов задаются переменными `NGINX_LISTEN`, `NGINX_UPSTREAM` и
`NGINX_SITES_ROOT`; Kroy не вызывает `sudo`.

Для применения уже опубликованной конфигурации:

```bash
yarn preview:reload
```

Kroy Nginx раздаёт каталог каждого сайта только на связанных с ним доменах, применяет правила `301`/`410` и проксирует динамические маршруты в Vyaz. Исходный Host, IP клиента и внешний HTTPS-протокол передаются через оба прокси. Неизвестный Host получает `404`. Конфигурация проверяется через `nginx -t -c dist/kroy/nginx/nginx.conf` до reload.

Preview использует все точные hostname из таблицы `domains` и обслуживает их по HTTP на `127.0.0.1:8080`. Для домена, которого нет в локальном DNS, можно использовать `curl --resolve`, например:

```bash
curl --resolve vet.example.test:8080:127.0.0.1 http://vet.example.test:8080/
```

Это только локальная проверка сборки: Kroy не настраивает публичный DNS, HTTPS или production-публикацию. Эти механизмы предстоит реализовать отдельно.

Для VPS используйте `infra/ansible/kroy-nginx.yml`: он настраивает systemd-сервис
отдельного Nginx Kroy и небольшой reverse-proxy-файл системного Nginx для
`*.oysite.ru`. Основной конфиг системного Nginx, Matrix и TLS playbook не
перезаписывает; установка самого Nginx не выполняется.

Публичные пути используют только нижний регистр, цифры и дефисы в непустых сегментах: `/`, `/services`, `/about/team`, `/our-services`. Проценты, URL-кодировки, пробелы, точки и метасимволы не допускаются, чтобы PostgreSQL, браузер, файловая система и Nginx однозначно трактовали адрес. Первые сегменты `admin`, `api`, `public`, `static` и `uploads` зарезервированы для приложения.

## Production и standalone-команды

Прямые команды `yarn build`, `yarn serve`, `yarn site:publish` и команды работы
с БД предназначены для production/standalone-окружения. Они используют
`DATABASE_URL` из `.env`; development использует только команды `docker compose
... exec app` из [infra/README.md](infra/README.md).

Для standalone-окружения создайте локальный файл окружения и PostgreSQL:

```bash
cp .env.example .env
createuser --pwprompt --createdb kroy
createdb -O kroy kroy
```

Управление миграциями:

```bash
yarn db:migrate
yarn db:status
yarn db:rollback
yarn db:seed
```

`db:rollback` и `db:seed` перед выполнением запрашивают подтверждение в
интерактивном терминале. Параметры подключения задаются в `DATABASE_URL`.
Docker Compose для production не требуется.

## Вход в административную панель

Задайте в `.env` случайный `AUTH_SECRET` (не менее 32 случайных байт), затем создайте администратора:

```bash
yarn user:create admin@example.org --superadmin
yarn vyaz:build
yarn vyaz:serve
```

CLI запрашивает пароль без отображения в терминале. Не передавайте пароль аргументом команды.
Страница входа `/auth/signin` — кастомная (`pages/SignInPage.jsx`, подключена через `LAYOUT_AUTH` в `server.mjs`);
выход доступен через стандартную страницу Auth.js `/auth/signout`.
Гость при открытии `/admin` перенаправляется на вход. Административные страницы и API доступны
только активным superadmin; обычные пользователи получают отказ, заблокированные не могут войти.
В сессии хранятся `id`, `email` и `is_superadmin`. Права доступа повторно проверяются по БД.
`GET /api/media/:mediaId` остаётся публичным для изображений сайта.

Генератор Nginx проксирует `/auth` и `/auth/*`. Для уже собранных сайтов нужно обновить
конфигурацию обычной сборкой/публикацией сайта и выполнить `yarn preview:reload`.
Входите на том же домене, на котором открываете редактор: сессионные cookies привязаны к домену.

API страниц определяет сайт только по заголовку `Host` и таблице `domains`:

```text
GET /api/pages
GET /api/pages?deleted=1
POST /api/pages
GET /api/pages?path=/
GET /api/pages/:pageId
PATCH /api/pages/:pageId
PUT /api/pages/:pageId
DELETE /api/pages/:pageId
POST /api/pages/:pageId/restore
```

Для демонстрационного сайта используйте домен из таблицы `domains`; Nginx сохраняет исходный `Host`, по которому API определяет сайт.

Удаление страницы является мягким: запись и содержимое сохраняются в PostgreSQL, а занятый путь нельзя использовать повторно. Главную страницу удалить нельзя. Удалённые страницы доступны в `/admin/pages/trash` и могут быть восстановлены.

При изменении публичного пути прежний адрес сохраняется в `redirects` со ссылкой на UUID страницы. Создание страниц и изменение путей выполняются транзакционно; зарезервированный редиректом адрес нельзя занять другой страницей. Статическая сборка формирует правила `301` и `410`, а локальный Nginx применяет их в preview.

## Документация

- [Продукт, роли и границы MVP](docs/PRODUCT.md)
- [Запчасти, JSDoc и реестр](docs/PARTS.md)
- [Редактор и формат данных страницы](docs/EDITOR.md)
- [Целевая архитектура и публикация](docs/ARCHITECTURE.md)

## Дальше

Планируются окончательное удаление страниц, production-настройка Nginx, управление сайтами и доменами и общий backend для динамических функций.
