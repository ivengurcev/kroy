# Project Command Help Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить компактную терминальную справку по существующим командам Kroy и её краткую копию в README.

**Architecture:** Статический ESM-скрипт выводит проверенный по `package.json` текст без выполнения команд. Package scripts предоставляют гарантированный `kroy:help` и явный `run help`, а README объясняет конфликт с Yarn 4.

**Tech Stack:** JavaScript, Yarn 4, Markdown

**Spec:** `docs/superpowers/specs/2026-10-21-project-command-help-design.md`

## Global Constraints

- Без новых зависимостей и интерактивного CLI.
- Не менять существующие команды или инфраструктуру.
- Проверки ограничить `git diff --check` и одним `yarn vyaz:build`.

## Review Focus

- Аргументы команд должны совпадать с фактическим чтением `process.argv`.
- `yarn help` нельзя описывать как пользовательскую команду в Yarn 4.
- Сборка Vyaz и публичного сайта должны быть явно разделены.
- Сценарии публикации должны включать подготовку через `site:build`.
- Скрипт справки не должен иметь побочных эффектов.

---

### Task 1: Терминальная справка и документация

**Files:**
- Create: `scripts/help.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: существующие package scripts и их аргументы
- Produces: `yarn kroy:help` и `yarn run help`

- [ ] **Step 1:** Добавить `scripts/help.mjs` с разделами команд и быстрыми сценариями на русском языке.
- [ ] **Step 2:** Зарегистрировать `help` и `kroy:help`, не меняя остальные scripts.
- [ ] **Step 3:** Добавить в README компактную справку и пояснение о встроенном `yarn help`.
- [ ] **Step 4:** Выполнить `git diff --check` и `yarn vyaz:build`.
