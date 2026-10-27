# Additional Color Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two public site themes, «Вердант» and «Янтарь», to the existing theme picker.

**Architecture:** Add two JSON files matching the established theme schema. The existing file-based registry discovers and validates them, so the editor and stored site settings require no code changes.

**Tech Stack:** JSON theme files, Node.js file-based registry.

**Spec:** `docs/superpowers/specs/2026-10-27-add-color-themes-design.md`

## Global Constraints

- Do not change components, theme APIs, database, token metadata, or existing themes.
- Supply the same token keys in light and dark palettes.
- Do not add dependencies, tests, browser/E2E checks, or new tokens.
- Run `git diff --check` and one `yarn vyaz:build`.

## Review Focus

- A site switches between the new themes: task 1 uses unique kebab-case IDs accepted by the existing registry.
- Dark mode is selected: task 1 supplies a full contrasting dark palette rather than reusing light values.
- The picker thumbnail reads shared properties: task 1 preserves shared fonts, radius, spacing, and container keys in each palette.

---

### Task 1: Add two palette files

**Files:**
- Create: `themes/verdant.json`
- Create: `themes/amber.json`

**Interfaces:**
- Produces: valid theme registry records with `id`, `name`, `description`, and matching `tokens.light` / `tokens.dark` keys.

- [x] **Step 1: Add the green/biruz `verdant` theme**

Use the supplied green and blue palette for accent colours, with readable neutral light and deep green dark backgrounds.

- [x] **Step 2: Add the warm `amber` theme**

Use the supplied yellow/orange palette for accent colours, with readable warm light and dark brown backgrounds.

### Task 2: Verification

**Files:**
- Modify: none

- [x] **Step 1: Check whitespace**

Run: `git diff --check`

Expected: no output and exit code 0.

- [x] **Step 2: Build once**

Run: `yarn vyaz:build`

Expected: theme registry validation and production build succeed.
