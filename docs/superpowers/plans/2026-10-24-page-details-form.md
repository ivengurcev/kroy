# Page Details Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переиспользовать одну форму изменения названия и пути страницы в карте страниц и модальном окне шапки редактора.

**Architecture:** Новый `PageDetailsForm` владеет черновиком, PATCH-запросом, статусом, ошибками, Escape и фокусом. `PageList` и `PageDetailsDialog` отвечают только за размещение формы, а `PagesPage` и `Editor` применяют возвращённую сервером страницу к своему состоянию.

**Tech Stack:** JavaScript, React 19, CSS Modules, нативный `<dialog>`, Vyaz, esbuild.

**Spec:** `docs/superpowers/specs/2026-10-24-page-details-form-design.md`

## Global Constraints

- Не менять серверный API, PostgreSQL, маршруты и формат страницы.
- Не изменять `content`, `isDirty`, `saveStatus` и сохранение запчастей при PATCH реквизитов.
- Не добавлять зависимости и универсальный конструктор форм.
- Сохранить существующую геометрию и поведение `PageList`.
- Не создавать тесты и не запускать браузерные проверки.
- Выполнить только `git diff --check` и один `yarn vyaz:build`.

## Review Focus

- Главная страница `/` отправляет только `title`, даже если отключённое поле пути присутствует в форме.
- Ошибки `400`, `409` и сетевые ошибки сохраняют введённые значения и оставляют форму открытой.
- Escape не закрывает форму во время PATCH и возвращает фокус после обычной отмены.
- Смена редактируемой строки сбрасывает черновик, ошибку и dirty-состояние предыдущей страницы.
- Успешный PATCH из шапки не изменяет состояние содержимого и не перезагружает редактор.

---

### Task 1: Общая форма реквизитов страницы

**Files:**
- Create: `components/admin/PageDetailsForm.jsx`
- Create: `components/admin/PageDetailsForm.module.css`

**Interfaces:**
- Consumes: `page: { id, title, path }`, `onSaved(updatedPage)`, `onCancel()`, необязательные `onDirtyChange(isDirty)`, `onErrorChange(message)` и CSS-классы `className`, `pathClassName`, `titleClassName`, `actionsClassName`.
- Produces: единый `<form>` с PATCH `/api/pages/:pageId`, локальным черновиком и сообщением ошибки; `showError` управляет встроенным выводом сообщения для диалога.

- [ ] **Step 1: Создать локальное состояние и синхронизацию страницы**

В `PageDetailsForm` хранить `title`, `path`, `status` и `error`. При изменении `page.id/title/path` восстановить начальные значения и `idle`. Вычислять dirty сравнением с `page` и сообщать его через `onDirtyChange`.

- [ ] **Step 2: Реализовать фокус, Escape и кнопки**

После открытия сфокусировать path для обычной страницы и title для `/`. Обработчик Escape вызывает `onCancel`, только если `status !== 'submitting'`. Кнопки используют существующие `Button`/`Icon`, имеют `title`; сохранение отключено без изменений и во время запроса.

- [ ] **Step 3: Реализовать единственный PATCH-поток**

Отправлять `{ title }` для `/` и `{ title, path }` для остальных страниц. На успехе вызывать `onSaved(await response.json())`. Для `400`, `409` и остальных ошибок задавать тексты из спецификации, вызывать `onErrorChange` и сохранять черновик.

- [ ] **Step 4: Добавить минимальные общие стили**

Оформить стандартное вертикальное представление полей, действий и ошибки для диалога. Переданные CSS-классы объединять с базовыми, чтобы `PageList` мог сохранить собственную grid-сетку.

### Task 2: Перевести PageList на общую форму

**Files:**
- Modify: `components/admin/PageList.jsx`
- Modify: `components/admin/PageList.module.css`
- Modify: `pages/PagesPage.jsx`

**Interfaces:**
- Consumes: `PageDetailsForm`; callback `onUpdate(updatedPage)` без сетевого запроса.
- Produces: прежний inline-интерфейс списка с общей логикой PATCH и локальным применением результата в `PagesPage`.

- [ ] **Step 1: Упростить состояние `PageList`**

Заменить объект `editing`, `editStatus` и `editError` на `editingPage`, `editDirty` и `editErrorMessage`. Сохранить запрет открытия другой строки при изменённом черновике и возврат фокуса кнопке «Изменить».

- [ ] **Step 2: Подключить `PageDetailsForm` в строку**

Передать существующие `rowContents`, `path`, `title`, `actions`; отключить встроенный вывод ошибки и направить сообщение в существующую зарезервированную `errorArea`. На cancel закрыть строку, на success вызвать `onUpdate(updatedPage)`, закрыть строку и вернуть фокус.

- [ ] **Step 3: Сохранить фиксированную геометрию**

При необходимости уточнить селекторы `PageList.module.css`, чтобы общие базовые стили формы не меняли высоту строки, grid-area, мобильную сетку и ширину действий.

- [ ] **Step 4: Удалить PATCH из `PagesPage`**

Заменить `updatePage(pageId, values)` на синхронный `updatePage(updatedPage)`, который только заменяет `title/path` страницы с тем же `id` в локальном массиве. Создание и удаление не менять.

### Task 3: Диалог в шапке и обновление Editor

**Files:**
- Create: `components/admin/PageDetailsDialog.jsx`
- Create: `components/admin/PageDetailsDialog.module.css`
- Modify: `components/admin/AdminHeader.jsx`
- Modify: `components/admin/AdminShell.jsx`
- Modify: `editor/Editor.jsx`

**Interfaces:**
- Consumes: `PageDetailsForm`, `page`, `open`, `onCancel`, `onSaved`.
- Produces: нативный модальный диалог; callback `onPageDetailsChange(updatedPage)` от `AdminHeader` через `AdminShell` к `Editor`.

- [ ] **Step 1: Создать нативный `PageDetailsDialog`**

После монтирования вызвать `dialogRef.current.showModal()`. Обработать нативный `cancel`: запретить стандартное закрытие и вызвать `onCancel`. Добавить доступный заголовок, общую форму и компактные адаптивные стили с `::backdrop`.

- [ ] **Step 2: Активировать карандаш в `AdminHeader`**

Хранить только `detailsOpen`; кнопка доступна при `loadStatus === 'success' && page.id`. Сохранять ref кнопки, открывать диалог по нажатию, закрывать после cancel/success и возвращать фокус через `requestAnimationFrame`. В pages-mode диалог не рендерить.

- [ ] **Step 3: Передать успешное обновление через оболочку**

Добавить `onPageDetailsChange` в props `AdminHeader` и `AdminShell`, не связывая его с `onSave` содержимого.

- [ ] **Step 4: Обновить только реквизиты в `Editor`**

Добавить callback, который записывает в `page` значения `id`, `title`, `path` из ответа, и передать его в `AdminShell`. Не вызывать `markDirty` и не менять `content`, `revision`, `isDirty` или `saveStatus`.

### Task 4: Техническая проверка

**Files:**
- Verify: файлы Tasks 1–3

**Interfaces:**
- Consumes: законченный diff.
- Produces: подтверждение корректной сборки и отсутствия пробельных ошибок.

- [ ] **Step 1: Проверить единственность PATCH**

Проверить исходники через `rg "method: 'PATCH'" components pages editor` и убедиться, что PATCH реквизитов находится только в `PageDetailsForm`.

- [ ] **Step 2: Проверить diff**

Run: `git diff --check`

Expected: код 0 без вывода.

- [ ] **Step 3: Выполнить одну профильную сборку**

Run: `yarn vyaz:build`

Expected: код 0.

- [ ] **Step 4: Подготовить ручную проверку**

Перечислить inline-редактирование, диалог, главную страницу, ошибки 400/409, Escape/фокус, изменение пути и сохранность несохранённого содержимого редактора.
