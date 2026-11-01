# Kroy / Oysite

Kroy — мультисайтовая платформа для небольших клиентских сайтов. Интерфейс Oysite
позволяет редактировать страницы из готовых блоков, вести каталог, отзывы и материалы с разделами,
настраивать оформление и публиковать сайт.

Стек: JavaScript, Bun 1.4.4, React 19, Vyaz (Hono, Auth.js, SSR), esbuild,
PostgreSQL и Nginx. Запчасти готовят данные, виджеты отображают их.
Админка и API работают через Vyaz, публичные страницы — готовый HTML
с гидратацией. Сохранение в БД и публикация релиза выполняются отдельно.

## Разработка

Нужны Bun 1.4.4 и Docker Compose plugin. Из корня репозитория:

```bash
bun run dev
```

В другом терминале для пустой БД:

```bash
bun run dev:run db:seed
bun run dev:run user:create admin@example.org --superadmin
bun run dev:run site:publish demo
```

Seed и создание пользователя интерактивны. Откройте
`http://demo.localhost:8080/admin`; пароль не передавайте аргументом команды.
PostgreSQL, приложение и Nginx работают внутри Compose.

| Задача | Команда |
|---|---|
| Справка | `bun run help` или `bun run kroy:help` |
| Development | `bun run dev:bg`, `bun run dev:down`, `bun run dev:logs`, `bun run dev:status` |
| Команда внутри app | `bun run dev:run <script> [...args]` |
| Подготовить без публикации | `bun run dev:run site:build <slug>` |
| Опубликовать сохранённое | `bun run dev:run site:publish <slug>` |
| Релизы и откат | `bun run dev:run site:releases <slug>`, `bun run dev:run site:rollback <slug> <release-id>` |
| Удалённое управление | `bun run remote <script> [...args]`, `bun run deploy app`, `bun run deploy site <slug>` |

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
