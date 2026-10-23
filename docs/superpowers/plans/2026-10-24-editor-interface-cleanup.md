# Editor Interface Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Удалить выбор запчастей и футер редактора, выровнять шапку с рабочей областью и унифицировать подсказки и курсоры административных действий.

**Architecture:** `Editor.jsx` остаётся владельцем содержимого страницы, а `EditorWorkspace` хранит только локальный `editingPartId`. Общая геометрия задаётся токеном административной темы; подсказки остаются обычными атрибутами `title`, а курсор централизуется в базовом `Button`.

**Tech Stack:** JavaScript, React 19, CSS Modules, Vyaz, esbuild.

**Spec:** `docs/superpowers/specs/2026-10-24-editor-interface-cleanup-design.md`

## Global Constraints

- Не менять API, базу данных, формат `{ part, props }` и механизм сохранения.
- Не менять публичный рендеринг и компоненты запчастей.
- Не добавлять зависимости, Tooltip-компоненты и новые абстракции.
- Не создавать тесты и не запускать браузерные проверки.
- Выполнить только `git diff --check` и один `yarn vyaz:build`.

## Review Focus

- После загрузки, добавления и удаления запчасти редактор не должен обращаться к удалённому состоянию выбора.
- Перемещение редактируемой запчасти должно сохранять открытый `PartEditor` благодаря стабильному `id`.
- Удаление редактируемой запчасти должно закрывать форму и не оставлять устаревшее состояние.
- На узкой ширине общий предел ширины не должен создавать горизонтальную прокрутку.
- `title` и `aria-label` иконочных действий должны описывать одно и то же действие.

---

### Task 1: Удалить выбор запчастей и устаревшие панели

**Files:**
- Modify: `editor/Editor.jsx`
- Modify: `components/admin/AdminShell.jsx`
- Modify: `editor/EditorWorkspace.jsx`
- Delete: `editor/BlockInspector.jsx`
- Delete: `editor/BlockInspector.module.css`
- Delete: `editor/EditorFooter.jsx`
- Delete: `editor/EditorFooter.module.css`

**Interfaces:**
- Consumes: существующие `content`, `editingPartId`, операции добавления, удаления, перемещения и изменения props.
- Produces: `EditorWorkspace` без `selectedPartId` и `onSelectPart`; `AdminShell` без футера и props выбора.

- [ ] **Step 1: Упростить состояние `Editor.jsx`**

Удалить `selectedPartId`, его инициализацию после загрузки, обновление после добавления и удаления и передачу `selectedPartId`/`onSelectPart` в `AdminShell`. Остальные операции и сериализацию страницы не менять.

- [ ] **Step 2: Упростить композицию `AdminShell.jsx`**

Удалить props выбора, импорт и рендер `EditorFooter`; передавать в `EditorWorkspace` только данные и рабочие обработчики.

- [ ] **Step 3: Оставить в `EditorWorkspace.jsx` только просмотр и редактирование**

Удалить props выбора, `selectPart`, `onClickCapture`, условный класс выбранной запчасти и вызов выбора из `editPart(id)`. Сохранить `editingPartId`, переключение `Редактировать`/`Закрыть`, закрытие при удалении и неизменность состояния при перемещении/обновлении props.

- [ ] **Step 4: Удалить устаревшие файлы**

Удалить `BlockInspector` и `EditorFooter` с CSS Modules после проверки отсутствия оставшихся импортов через `rg`.

### Task 2: Согласовать геометрию и постоянную рамку

**Files:**
- Modify: `styles/AdminTheme.module.css`
- Modify: `components/admin/AdminHeader.module.css`
- Modify: `editor/EditorWorkspace.module.css`

**Interfaces:**
- Consumes: административные токены и существующие оболочки `.headerBar`, `.workspace`, `.previewPart`.
- Produces: общий `--admin-content-max`, одинаковое центрирование шапки и workspace, постоянную нейтральную рамку запчасти.

- [ ] **Step 1: Добавить общий токен ширины**

Добавить в scoped-тему `--admin-content-max: 1800px`; не менять публичную тему.

- [ ] **Step 2: Выровнять шапку**

Применить к `.headerBar` `max-width: var(--admin-content-max)` и `margin-inline: auto`, сохранив `width: 100%`. Добавить лёгкую тень без изменения высоты и адаптивных правил.

- [ ] **Step 3: Выровнять workspace и заменить состояния рамки**

Заменить локальные `max-width: 1800px` на общий токен. Для `.previewPart` установить внешнюю нейтральную рамку через `box-shadow: 0 0 0 1px var(--color-border)` и `border-radius: 0`; удалить правила `.previewPart:hover` и `.selectedPart`. Не менять геометрию шапки, формы и публичного содержимого.

### Task 3: Добавить нативные подсказки и единый курсор

**Files:**
- Modify: `components/ui/Button.module.css`
- Modify: `components/ui/Tabs.jsx`
- Modify: `components/ui/SegmentedControl.jsx`
- Modify: `components/admin/AdminHeader.jsx`
- Modify: `components/admin/PageList.jsx`
- Modify: `pages/PagesPage.jsx`
- Modify: `pages/TrashPage.jsx`
- Modify: `editor/EditorWorkspace.jsx`
- Modify: `editor/PartControls.jsx`
- Modify: `editor/PartPicker.jsx`
- Modify: `editor/ListField.jsx`
- Modify: `editor/ImageField.jsx`

**Interfaces:**
- Consumes: существующий `Button`, нативные `button`/`a`, текущие `aria-label` и подписи действий.
- Produces: обычные `title` у всех административных действий; `pointer` у активных Button и `default` у отключённых.

- [ ] **Step 1: Централизовать курсор `Button`**

Добавить `.button { cursor: pointer; }`, сохранив более специфичный `.button:disabled { cursor: default; }`. Для ссылок-кнопок оставить или добавить `cursor: pointer` в их существующих локальных стилях только там, где он не наследуется автоматически.

- [ ] **Step 2: Описать действия редактора**

Добавить точные `title` в `EditorWorkspace`, `PartControls`, `PartPicker`, `ListField` и `ImageField`: добавление/выбор запчасти, открытие и закрытие редактирования, перемещение, удаление, меню списка, добавление элемента, завершение редактирования и загрузка изображения. Для иконочных кнопок согласовать `aria-label` с полным назначением, например «Переместить запчасть вверх».

- [ ] **Step 3: Описать действия административной шапки и страниц**

Добавить `title` кнопкам и кнопочным ссылкам в `AdminHeader`, `PageList`, `PagesPage` и `TrashPage`: настройки, карта страниц, изменение страницы, сохранение, публикация, предпросмотр, создание, изменение, удаление, восстановление, отмена, корзина и возврат. Динамический статус на кнопке сохранения сохранить.

- [ ] **Step 4: Покрыть нативные UI-кнопки**

Добавить `title={item.label}` в `Tabs` и `SegmentedControl`, не меняя их отключённое состояние и поведение. Не создавать обёртки для disabled-кнопок.

### Task 4: Финальная техническая проверка

**Files:**
- Verify: все изменённые и удалённые файлы из Tasks 1–3

**Interfaces:**
- Consumes: законченный diff.
- Produces: подтверждение отсутствия пробельных ошибок и успешной профильной сборки.

- [ ] **Step 1: Проверить остаточные ссылки**

Выполнить `rg "selectedPartId|selectedPart|onSelectPart|EditorFooter|BlockInspector" editor components pages` и убедиться, что рабочий код больше не содержит удалённого механизма.

- [ ] **Step 2: Проверить diff**

Run: `git diff --check`

Expected: команда завершается с кодом 0 без вывода.

- [ ] **Step 3: Выполнить одну профильную сборку**

Run: `yarn vyaz:build`

Expected: команда завершается с кодом 0.

- [ ] **Step 4: Подготовить ручную проверку**

Перечислить пользователю: совпадение краёв шапки и workspace, постоянную прямоугольную рамку, отсутствие реакции на клик по содержимому, переключение одной inline-формы, сохранение формы при перемещении, подсказки/курсоры и адаптивность.
