# Publication Toast and Static Site Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show publication feedback as a bounded toast and make published sites use the saved public theme exactly as preview does.

**Architecture:** Keep the existing publication API and task state. `AdminHeader` controls only toast visibility and timer lifetime. `site:build` creates one generated theme-snapshot module from the same database read as the pages; static SSR, static hydration, and preview pass that snapshot through `SiteApp` into `SiteRoot`, where system mode is resolved after hydration.

**Tech Stack:** React 19, CSS Modules, Node.js, PostgreSQL, esbuild, Yarn PnP.

**Spec:** `docs/superpowers/specs/2026-10-27-publication-toast-and-theme-design.md`

## Global Constraints

- Do not add dependencies or rewrite the publication or theme systems.
- Keep `AdminTheme.module.css` scoped to administration and `--site-*` tokens scoped to public rendering.
- Preserve `light`, `dark`, and `system` modes and existing saved theme overrides.
- Do not run browser, E2E, or additional test infrastructure; run `git diff --check` and one `yarn vyaz:build` after implementation.

## Review Focus

- A second publication begins while a terminal-toast timer is pending: task 1 clears the old timer and keeps the new progress visible.
- A theme in system mode is rendered on a dark system: task 2 starts SSR and hydration in light mode, then updates only after hydration.
- A custom light or dark override is saved: task 2 reads it in the build transaction and emits it in the snapshot.
- Preview uses system mode: task 3 removes its parallel palette-selection path and passes the shared snapshot.
- A static public build is inspected: task 2 keeps admin CSS and admin `--color-*` tokens out of its entry points.

---

### Task 1: Publication toast lifecycle

**Files:**
- Modify: `components/admin/AdminHeader.jsx`
- Modify: `components/admin/AdminHeader.module.css`

**Interfaces:**
- Consumes: the existing `publication` state with `idle`, `building`, `publishing`, `success`, and `error` statuses.
- Produces: fixed progress/result feedback without changing publication requests or server task state.

- [x] **Step 1: Add terminal-result visibility state in `AdminHeader.jsx`**

Create a five-second timeout only when the latest state is `success` or `error`; clear it on cleanup and when a new non-terminal publication begins. Render progress while building/publishing regardless of the terminal-toast visibility state.

- [x] **Step 2: Render one publication toast and move it to the viewport bottom centre**

Keep existing accessible `role="status"` / `role="alert"` semantics, but use `position: fixed`, a centred transform, and viewport-safe width. Preserve existing success/error visual tokens.

- [x] **Step 3: Check the diff for unrelated header changes**

Run: `git diff -- components/admin/AdminHeader.jsx components/admin/AdminHeader.module.css`

Expected: only toast lifecycle and positioning changes.

### Task 2: Static render theme snapshot

**Files:**
- Modify: `scripts/buildSite.mjs`
- Modify: `scripts/renderSite.jsx`
- Modify: `scripts/hydrateSite.jsx`
- Modify: `layout/SiteApp.jsx`
- Modify: `layout/SiteRoot.jsx`

**Interfaces:**
- Consumes: `getThemeTokens(themeId, mode, overrides)` and a site’s `theme_id`, `theme_mode`, and `theme_overrides`.
- Produces: generated `dist/kroy/site-theme.mjs` exporting `{ mode, light, dark }`; `SiteApp` accepts `theme` and forwards it to `SiteRoot`.

- [x] **Step 1: Read theme settings in the existing repeatable-read build transaction**

Extend the site row read in `scripts/buildSite.mjs`, compute the independent light and dark `--site-*` token maps with `getThemeTokens()`, and write `site-theme.mjs` beside the existing generated page module before bundling static SSR/client entries.

- [x] **Step 2: Pass the generated snapshot to both static entry points**

Import `theme` in `renderSite.jsx` and `hydrateSite.jsx`; pass it to `SiteApp` so the server HTML and hydration start from the same data.

- [x] **Step 3: Resolve a snapshot in `SiteRoot` without an SSR mismatch**

For fixed modes choose the matching palette. For system mode initialise as light and, after hydration, observe `prefers-color-scheme` changes to select dark/light. Apply only the selected `--site-*` map to the public root.

- [x] **Step 4: Check static entry-point boundaries**

Run: `git diff -- scripts/buildSite.mjs scripts/renderSite.jsx scripts/hydrateSite.jsx layout/SiteApp.jsx layout/SiteRoot.jsx`

Expected: static site paths receive theme data without importing `AdminTheme.module.css`.

### Task 3: Preview uses the same public theme route

**Files:**
- Modify: `pages/PreviewPage.jsx`

**Interfaces:**
- Consumes: `SiteApp`’s `theme` prop from task 2 and the saved preview theme response.
- Produces: preview palette selection delegated to `SiteRoot`.

- [x] **Step 1: Replace preview-local system palette selection**

Build the same `{ mode, light, dark }` shape from the preview response and pass it to `SiteApp`; remove the preview-specific `matchMedia` state so preview and published rendering have one mode-selection implementation.

- [x] **Step 2: Preserve the private preview notice styles**

Keep the preview-only administration UI and its styles separate from the public `SiteApp` subtree.

### Task 4: Verification

**Files:**
- Modify: none

- [x] **Step 1: Inspect the complete change set**

Run: `git diff --check`

Expected: no whitespace errors.

- [x] **Step 2: Build the application once**

Run: `yarn vyaz:build`

Expected: production build succeeds.

- [x] **Step 3: Report manual checks**

Report the publication success/error timeout, immediate repeat publication, saved light/dark overrides, and system-mode preview/static comparison for browser verification.
