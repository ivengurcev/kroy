# Kroy / Oysite

Kroy — мультисайтовая платформа для небольших клиентских сайтов. Интерфейс Oysite
позволяет редактировать страницы из готовых блоков, вести каталог, отзывы и статьи,
настраивать оформление и публиковать сайт.

Стек: JavaScript, React 19, Vyaz (Hono, Auth.js, SSR), esbuild, PostgreSQL,
Yarn 4 PnP и Nginx. Запчасти готовят данные, виджеты отображают их.
Админка и API работают через Vyaz, публичные страницы — готовый HTML
с гидратацией. Сохранение в БД и публикация релиза выполняются отдельно.

## Разработка

Нужны Docker с Compose plugin и Yarn 4. Из корня репозитория:

```bash
yarn dev
```

В другом терминале для пустой БД:

```bash
yarn dev:run db:seed
yarn dev:run user:create admin@example.org --superadmin
yarn dev:run site:publish demo
```

Seed и создание пользователя интерактивны. Откройте
`http://demo.localhost:8080/admin`; пароль не передавайте аргументом команды.
PostgreSQL, приложение и Nginx работают внутри Compose.

| Задача | Команда |
|---|---|
| Справка | `yarn kroy:help` (или `yarn run help`; `yarn help` — справка Yarn) |
| Development | `yarn dev:bg`, `yarn dev:down`, `yarn dev:logs`, `yarn dev:status` |
| Команда внутри app | `yarn dev:run <script> [...args]` |
| Подготовить без публикации | `yarn dev:run site:build <slug>` |
| Опубликовать сохранённое | `yarn dev:run site:publish <slug>` |
| Релизы и откат | `yarn dev:run site:releases <slug>`, `yarn dev:run site:rollback <slug> <release-id>` |
| Удалённое управление | `yarn remote <script> [...args]`, `yarn deploy app`, `yarn deploy site <slug>` |

Для удалённых команд задайте `KROY_REMOTE_HOST=user@example.org`.
Инструкции первого запуска, миграций, standalone, диагностики и переноса данных —
в [infra/README.md](infra/README.md). Production без Docker, Ansible, systemd и
HTTPS описаны в [infra/ansible/README.md](infra/ansible/README.md).
Артефакты в `dist/` генерируются; загруженные медиа находятся в `data/media/`.

## Документация

- [Требования, роли, объём MVP и открытые решения](docs/requirements.md)
- [Обязательные архитектурные правила](docs/arch-rules.md)
- [Архитектура и принятые решения](docs/architecture.md)
- [Запчасти, виджеты, JSDoc и миграция content](docs/PARTS.md)
- [Редактор и предпросмотр](docs/EDITOR.md)
- [URL, API и управление сайтами](docs/ROUTING.md)
- [Prodamus: настройки и checkout](docs/prodamus.md)
- [Инструкции агентам](AGENTS.md)
- [Исторические планы и спецификации](docs/superpowers/README.md) — рабочие материалы,
  могут содержать отменённые решения и не являются текущими требованиями.
