# Site Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить приватный предпросмотр сохранённого сайта по `/admin/preview?path=...` с настоящими запчастями, темой и внутренней навигацией.

**Architecture:** Приватный API возвращает единый снимок неудалённых страниц текущего сайта и рассчитанные светлую/тёмную палитры. Клиентская страница предпросмотра передаёт данные в существующий `SiteApp`; расширение его URL-адаптера сохраняет одну реализацию навигации для публичного сайта и preview.

**Tech Stack:** JavaScript, React 19, Vyaz, PostgreSQL, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-10-27-site-preview-design.md`

## Global Constraints

- Без новых зависимостей и отдельного сервера.
- Не менять формат страниц, структуру БД, публикацию и релизы.
- Предпросмотр использует только сохранённые страницы и настройки текущего сайта по `Host`.
- Маршрут и API остаются приватными через существующие `auth` и `hasAccess`.
- Публичный `SiteApp` сохраняет текущее поведение.
- По правилам `AGENTS.md` не добавлять новую тестовую инфраструктуру и не запускать браузерные/E2E-тесты.

## Review Focus

- Прямой `/admin/preview?path=/missing` показывает 404, а не опубликованный сайт.
- `system` обновляет палитру после изменения `prefers-color-scheme`.
- Внутренняя ссылка меняет только query `path`, внешняя ссылка остаётся внешней.
- Обычный пользователь не может получить preview другого `Host`; superadmin сохраняет текущие права.
- Изменения формы после последнего сохранения не попадают в новую вкладку preview.

---

### Task 1: Приватный снимок предпросмотра

**Files:**
- Create: `api/getSitePreview.mjs`
- Modify: `server.mjs`

**Interfaces:**
- Consumes: `getHostname(c)`, `getSiteTheme(siteId)`, `getThemeTokens(themeId, mode, overrides)`.
- Produces: private `GET /api/site/preview` returning `{ pages, theme: { mode, light, dark } }`.

- [ ] Реализовать один SQL-запрос сайта и его неудалённых страниц по `Host`, без параметра `site_id` от клиента.
- [ ] Рассчитать обе палитры через `getThemeTokens()` с сохранёнными переопределениями.
- [ ] Зарегистрировать endpoint как `private: true` до wildcard API-маршрута.
- [ ] Проверить неизвестный Host и сайт без страниц: данные другого сайта не возвращаются, API отвечает корректным 404 или пустым реестром текущего сайта.

### Task 2: Переиспользуемая навигация `SiteApp`

**Files:**
- Modify: `layout/SiteApp.jsx`
- Modify: `layout/SiteRoot.jsx`

**Interfaces:**
- Consumes: `pages`, начальный `path`, `parts`, необязательные `pathFromUrl(url)`, `urlForPath(path)`, `notFound`, `tokens`.
- Produces: прежнее публичное поведение по умолчанию и preview-навигацию через адаптер URL.

- [ ] Расширить `SiteApp` необязательными адаптерами чтения и создания URL, сохранив текущие defaults.
- [ ] При preview-404 сохранять маршрут внутри preview и отображать переданный 404-компонент; публичный fallback оставить прежним.
- [ ] Передавать токены в `SiteRoot`; применять их inline как CSS custom properties только к публичному поддереву.
- [ ] Убедиться, что click, reload и popstate используют одну функцию разрешения публичного пути.

### Task 3: Страница предпросмотра и тема

**Files:**
- Create: `pages/PreviewPage.jsx`
- Create: `pages/PreviewPage.module.css`
- Modify: `server.mjs`

**Interfaces:**
- Consumes: `GET /api/site/preview`, `parts` из `dist/kroy/parts.mjs`, расширенный `SiteApp`.
- Produces: private route `/admin/preview`.

- [ ] Загрузить снимок после открытия страницы и нормализовать query `path`, по умолчанию `/`.
- [ ] Для `light`/`dark` выбрать заданную палитру; для `system` подписаться на `matchMedia('(prefers-color-scheme: dark)')` и корректно снять подписку.
- [ ] Передать в `SiteApp` адаптер `/admin/preview?path=...`, 404-состояние и рассчитанные токены.
- [ ] Добавить фиксированную плашку «Предпросмотр · сохранённая версия», не влияющую на геометрию сайта.
- [ ] Зарегистрировать route как `isPrivate: true` раньше общего `/admin/*`.

### Task 4: Кнопка открытия предпросмотра

**Files:**
- Modify: `components/admin/AdminHeader.jsx`

**Interfaces:**
- Consumes: существующие `mode`, `page.path`, `isDirty`.
- Produces: ссылка с `target="_blank"` на `/admin/preview?path=...`.

- [ ] Заменить disabled-кнопку preview на ссылку в существующих стилях шапки.
- [ ] В editor mode использовать текущий сохранённый `page.path`, в остальных режимах `/`.
- [ ] При `isDirty` показать предупреждение о том, что несохранённые изменения не попадут в preview; отмена предотвращает открытие вкладки.
- [ ] Сохранить `title`, `aria-label`, адаптивную иконку и `rel="noopener noreferrer"`.

### Task 5: Техническая проверка

**Files:**
- Verify all changed files.

- [ ] Выполнить `git diff --check`.
- [ ] Выполнить один `yarn vyaz:build`.
- [ ] В отчёте перечислить ручные проверки: главная/вложенная/404, click/back/forward/reload, три режима темы, изображения, гость/чужой Host, preview до публикации и предупреждение о dirty state.
