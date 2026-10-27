# Admin Site Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Публиковать сохранённую версию сайта текущего `Host` из общей шапки административного интерфейса.

**Architecture:** Приватный API запускает существующие package scripts `site:build` и `site:publish` в единственной последовательной фоновой задаче, хранимой в памяти процесса; терминальные статусы хранятся по ID сайта. `AdminHeader` запускает задачу и опрашивает её безопасный снимок состояния; существующие сборка, релизы, проверка и откат Nginx остаются источником истины.

**Tech Stack:** JavaScript, React 19, Hono/Vyaz API, PostgreSQL, Node.js child processes.

**Spec:** `docs/superpowers/specs/2026-10-27-admin-site-publishing-design.md`

## Global Constraints

- Не менять `site:build`, `site:publish`, PostgreSQL, релизы, Nginx, SSH-команды и ручную публикацию.
- Сайт определяется только сервером через `Host`; `site_id` и slug из клиента не принимаются.
- Без новых зависимостей, очередей, worker-процессов и автосохранения.
- Параллельные публикации блокируются глобально для вызовов административного API: сборка использует общие промежуточные файлы.
- По `AGENTS.md` не добавлять новые тесты и не запускать браузерные/E2E-тесты без отдельного запроса.

## Review Focus

- Повторный POST до завершения задачи не порождает второй `site:build`.
- Ошибка сборки не вызывает `site:publish`; ошибка публикации сохраняет текущий релиз существующим механизмом.
- Невалидный или чужой `Host` не раскрывает slug либо статус другой задачи.
- Навигация между административными страницами продолжает показывать активную задачу через GET/polling.
- Dirty-подтверждение отменяет только запуск из UI, не существующую задачу другого пользователя.

### Task 1: Серверная задача публикации и защищённый API

**Files:**
- Create: `api/sitePublish.mjs`
- Modify: `server.mjs`

**Interfaces:**
- Consumes: `getHostname(c)`, `pool`, `.yarn/releases/yarn-4.18.1.cjs`, package scripts `site:build` and `site:publish`.
- Produces: `GET /api/site/publish` and `POST /api/site/publish`, both `private: true`, returning `{ status, message?, releaseId?, finishedAt? }`.

- [ ] Resolve the current site with one database lookup by hostname and return 404 if it does not exist.
- [ ] Keep terminal tasks in an in-memory `Map` keyed by current `site.id`; an active task blocks all other POSTs, while a repeated POST for its own site returns its current state without creating another child process.
- [ ] Run the existing Yarn scripts sequentially through the checked-in Yarn release: `site:build <slug>`, then `site:publish <slug>` only on build success.
- [ ] Capture a bounded, human-readable process result; expose only status, result/error text, release ID when available, and finish time.
- [ ] Keep the last terminal result for GET, replace it only after a new POST, and delete no active state during the process.
- [ ] Register both private routes before the wildcard API route.

### Task 2: Состояние публикации в общей шапке

**Files:**
- Modify: `components/admin/AdminHeader.jsx`
- Modify: `components/admin/AdminHeader.module.css`

**Interfaces:**
- Consumes: `GET`/`POST /api/site/publish`, existing `isDirty`, `Icon`, `Button`, and common header action styles.
- Produces: active publishing control with idle, building, publishing, success, and error states on every admin page.

- [ ] On header mount, request the current publish state; poll only while it is active and clean up timers on unmount.
- [ ] Replace the disabled publish button with a guarded POST action; confirm dirty editor/site settings before initiating it, and suppress the request on cancellation.
- [ ] Disable duplicate clicks while a task is active and show compact stage labels without changing the single-row header layout.
- [ ] Render success and error feedback beneath the header with accessible status/alert semantics; keep response details bounded by the server contract.
- [ ] Preserve existing title, aria-label, mobile icon-only behavior, preview control, save behavior, and logout action.

### Task 3: Technical verification

**Files:**
- Verify all changed files.

- [ ] Run `git diff --check`.
- [ ] Run one `yarn vyaz:build`.
- [ ] Report manual checks: successful release, build failure, publish failure/current release, duplicate clicks, dirty confirmation, cross-host authorization, and header navigation while a task runs.

## Self-Review

- **Spec coverage:** Task 1 owns host isolation, sequential reuse of build/publish, task exclusivity, error safety, and existing release behavior. Task 2 owns UI process/result/error handling and dirty warnings. Task 3 owns required verification and manual scenarios.
- **Step scan:** Each task has one server or one UI boundary; neither changes existing CLI scripts or infrastructure.
- **Type consistency:** Both API verbs use the same site-scoped status snapshot consumed by `AdminHeader`.
- **Review focus:** The five likely regressions map to Task 1 state/process handling or Task 2 polling/confirmation behavior.
- **Proportion:** The plan adds one server module, two API registrations, and one compact client state layer; it avoids a general job framework.
