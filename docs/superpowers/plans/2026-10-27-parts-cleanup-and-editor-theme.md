# Parts Cleanup and Editor Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leave only Hero and Services, use public tokens in their styles, and render editor blocks with the saved site theme.

**Architecture:** Remove test part sources and replace their demo-page reference with Services. The editor obtains the existing saved-theme snapshot from `/api/site/preview` alongside the current page data, then forwards it through `AdminShell` and `EditorWorkspace` to the existing public `SiteRoot` resolution path.

**Tech Stack:** JavaScript, React 19, CSS Modules, PostgreSQL-backed Kroy API.

**Spec:** `docs/superpowers/specs/2026-10-27-parts-cleanup-and-editor-theme-design.md`

## Global Constraints

- Preserve `@kroy/hero`, `@kroy/services`, their prop APIs, and stored `{ part, props }` documents.
- Do not alter existing PostgreSQL pages, API endpoints, theme storage, or publication.
- Use only existing `--site-*` tokens in public parts; do not introduce admin tokens or new site tokens.
- Do not run browser/E2E checks or create tests; run `git diff --check` and one `yarn vyaz:build`.

## Review Focus

- Existing database documents reference deleted test parts: task 1 deliberately leaves them untouched; they require manual data migration before rendering.
- A theme request fails while page data succeeds: task 2 keeps the editor usable with default SiteRoot styling.
- The site is in system mode: task 2 forwards the full snapshot so SiteRoot keeps the established hydration-safe resolution.
- Demo seeding runs on a clean database: task 1 references only the two retained part IDs.
- Hero/Services render publicly: task 3 does not replace their component-specific geometry with generic token values.

---

### Task 1: Remove test parts and repair seeded content

**Files:**
- Delete: `parts/Articles.jsx`
- Delete: `parts/Gallery.jsx`
- Delete: `parts/contacts/Contacts.jsx`
- Delete: `parts/contacts/package.json`
- Delete: `parts/section/Main.jsx`
- Delete: `parts/section/subsection/Subsection.jsx`
- Delete: `parts/section/subsection/package.json`
- Modify: `demo/page.json`
- Modify: `README.md`
- Modify: `docs/PARTS.md`
- Modify: `docs/EDITOR.md`
- Modify: `docs/ARCHITECTURE.md`

**Interfaces:**
- Produces: generated registry containing only `@kroy/hero` and `@kroy/services`.
- Preserves: existing database documents unchanged.

- [x] **Step 1: Remove the five test part source groups**

Delete only the listed source and manifest files. Do not alter generated `dist/` output manually.

- [x] **Step 2: Replace demo Contacts content with Services content**

Use generic, non-site-specific example service data and keep the Hero reference.

- [x] **Step 3: Remove documentation examples that identify deleted parts as available**

Keep general architecture documentation and explain that existing stored pages are not auto-migrated.

### Task 2: Pass saved public theme into editor blocks

**Files:**
- Modify: `editor/Editor.jsx`
- Modify: `components/admin/AdminShell.jsx`
- Modify: `editor/EditorWorkspace.jsx`

**Interfaces:**
- Consumes: `/api/site/preview` response `theme: { mode, light, dark }`.
- Produces: `EditorWorkspace` passes `theme` into `SiteRoot` for public part rendering.

- [x] **Step 1: Load the theme snapshot in `Editor` without coupling it to page save state**

Fetch the existing endpoint with an AbortController; preserve page loading and retain `undefined` theme if the secondary request fails.

- [x] **Step 2: Forward `theme` through the existing shell and workspace props**

Pass it only to the view-mode `SiteRoot`, keeping form editing, saved content, and AdminTheme unchanged.

### Task 3: Align Hero and Services styles with public tokens

**Files:**
- Modify: `parts/hero/hero.module.css`
- Modify: `parts/services/services.module.css`

**Interfaces:**
- Consumes: existing public `--site-*` palette, typography, spacing and radius values.
- Produces: no admin-theme imports or new custom properties.

- [x] **Step 1: Replace remaining generic typography and spacing literals where an existing public token applies**

Keep responsive composition, container-query thresholds, controls, and component-specific dimensions intact.

- [x] **Step 2: Preserve existing visual controls and state styles**

Ensure focus, hover, accordion, social-link and caption styling continues to use public colour tokens.

### Task 4: Verification

**Files:**
- Modify: none

- [x] **Step 1: Check the diff**

Run: `git diff --check`

Expected: no whitespace errors.

- [x] **Step 2: Build once**

Run: `yarn vyaz:build`

Expected: discovery reports only Hero and Services and the production build succeeds.
