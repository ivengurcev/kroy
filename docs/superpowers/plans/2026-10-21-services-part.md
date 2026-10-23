# Services Part Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить `@kroy/services` с вложенными редактируемыми списками и сохранить локальное состояние элементов `ListField` при перестановке.

**Architecture:** Существующий JSDoc-парсер рекурсивно строит прежнюю схему `list` через разбор разделителей верхнего уровня. `ListField` хранит стабильные UI-ключи параллельно данным, а новая публичная запчасть независимо раскрывает категории через контролируемые `details` и локальные CSS Modules.

**Tech Stack:** JavaScript, React 19, CSS Modules, esbuild, Vyaz

**Spec:** `docs/superpowers/specs/2026-10-21-services-part-design.md`

## Global Constraints

- Не добавлять зависимости и служебные идентификаторы в `props`.
- Не менять Hero, `parts/section/Main.jsx`, API, PostgreSQL, Vyaz, публикацию и дизайн-токены.
- Сохранить существующие JSDoc-типы, настройки и компактный интерфейс `ListField`.
- Не создавать тесты или тестовую инфраструктуру; проверки ограничены требованиями `AGENTS.md`.

## Review Focus

- Запятые и двоеточия внутри вложенного объектного типа не должны разделять внешний объект.
- Собственное обновление `ListField` не должно перевыпускать UI-ключи.
- Внешняя замена `value` должна сбрасывать раскрытие и вложенное состояние.
- Перестановка должна переносить React-поддерево вложенного редактора вместе с элементом.
- Закрытый пользователем `details` не должен повторно открываться после рендера.

---

### Task 1: Рекурсивный разбор JSDoc-типов

**Files:**
- Modify: `scripts/parsePartDoc.mjs`

**Interfaces:**
- Consumes: строка типа из `comment-parser`
- Produces: прежняя схема `{ type: 'list', fields }` с рекурсивно вложенными `fields`

- [ ] **Step 1:** Добавить разбор строки по разделителю верхнего уровня с учётом глубины `{}`, `[]` и `()`.
- [ ] **Step 2:** Использовать его для полей объектного массива и поиска разделяющего двоеточия.
- [ ] **Step 3:** Оставить обработку примитивов, select и ошибок совместимой с текущим поведением.
- [ ] **Step 4:** Убедиться чтением схемы Services при сборке, что пути `categories.items.*` доступны существующему `findField`.

### Task 2: Стабильные UI-ключи ListField

**Files:**
- Modify: `editor/ListField.jsx`

**Interfaces:**
- Consumes: контролируемые `value` и `onChange`
- Produces: тот же массив пользовательских объектов без служебных полей

- [ ] **Step 1:** Создать локальный генератор ключей с префиксом `useId()` и монотонным счётчиком.
- [ ] **Step 2:** Хранить параллельный массив ключей и использовать ключ элемента для React, раскрытия и меню.
- [ ] **Step 3:** Синхронно изменять данные и ключи при добавлении, удалении и перестановке; не менять ключ при редактировании поля.
- [ ] **Step 4:** Отличать подтверждение собственного массива от внешней замены `value`; при внешней замене перевыпустить ключи и сбросить UI-состояние.
- [ ] **Step 5:** Сохранить текущую разметку, доступность и поведение компактного редактора.

### Task 3: Публичная запчасть Services

**Files:**
- Create: `parts/services/package.json`
- Create: `parts/services/Services.jsx`
- Create: `parts/services/services.module.css`

**Interfaces:**
- Consumes: `title`, `eyebrow`, `categories[].title`, `categories[].items[].name/price/note`
- Produces: запчасть `@kroy/services`, обнаруживаемую существующим `parts:generate`

- [ ] **Step 1:** Добавить package manifest с `name: "@kroy/services"` и `main: "Services.jsx"`.
- [ ] **Step 2:** Описать props и подписи всех уровней одним JSDoc-блоком непосредственно перед `export default`.
- [ ] **Step 3:** Реализовать категорию через контролируемый `details`, изначально открытый и сохраняющий пользовательское состояние.
- [ ] **Step 4:** Отрисовать только данные props без встроенных услуг и цен.
- [ ] **Step 5:** Добавить двухколоночную и узкую одноколоночную композиции через CSS container queries и существующие SiteTheme-токены.

### Task 4: Техническая проверка

**Files:**
- Verify: all changed files

**Interfaces:**
- Consumes: итоговая реализация Tasks 1–3
- Produces: подтверждение форматирования diff и сборки Vyaz

- [ ] **Step 1:** Выполнить `git diff --check` и подтвердить отсутствие ошибок.
- [ ] **Step 2:** Один раз выполнить `yarn vyaz:build` и подтвердить обнаружение `@kroy/services` и успешную сборку.
- [ ] **Step 3:** Не запускать браузерные, E2E и дополнительные сценарные проверки.
