# Page Map and Trash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the page map and trash routes with the shared Kroy admin shell and one stable, responsive row-list component while preserving all existing page operations.

**Architecture:** `Pages.jsx` and `Trash.jsx` remain stateful API owners. A presentation-only `AdminPageShell` shares the existing header and theme, while `PageList` owns sorting and inline edit UI but delegates PATCH, DELETE, and restore operations through callbacks.

**Tech Stack:** JavaScript, React 19, CSS Modules, Vyaz, existing Kroy page API.

**Spec:** `docs/superpowers/specs/2026-10-20-page-map-and-trash-design.md`

## Global Constraints

- Do not change API handlers, PostgreSQL, Vyaz, public site code, or part editing.
- Preserve `/admin`, `/admin/pages`, `/admin/pages/trash`, and `/admin/pages/:pageId/edit`.
- Add no dependencies, tables, modals, or new page-management capabilities.
- Keep `Pages.jsx` and `Trash.jsx` as owners of data and API operations.
- Use CSS Modules and scoped admin tokens; add no global rules.
- Create no tests or test infrastructure; run only `git diff --check` and one `yarn vyaz:build` after implementation.

## Review Focus

- Switching a row between display and edit must not change its dimensions at desktop or mobile breakpoints.
- Dirty inline editing must disable editing other rows, while an unchanged edit may switch directly.
- PATCH failure must preserve both entered values and the open edit row.
- Root `/` must allow title editing but never path editing or deletion.
- Sorting must update after PATCH and use depth before alphabetical path order in both modes.

---

### Task 1: Share the admin theme and shell

**Files:**
- Create: `editor/layout-preview/AdminTheme.module.css`
- Create: `editor/layout-preview/AdminPageShell.jsx`
- Create: `editor/layout-preview/AdminPageShell.module.css`
- Modify: `editor/layout-preview/AdminShell.jsx`
- Modify: `editor/layout-preview/AdminShell.module.css`
- Modify: `editor/layout-preview/AdminHeader.jsx`
- Modify: `editor/Editor.jsx`

**Interfaces:**
- Produces: `AdminPageShell({ title, actions, status, error, children })` and `AdminHeader({ mode, page, isDirty })`.
- Preserves: current editor appearance and `AdminShell` behavior.

- [ ] **Step 1: Extract scoped design tokens**

Move the complete base and semantic custom-property block from `.adminShell` into `.theme` in `AdminTheme.module.css`. Apply both `theme.theme` and `styles.adminShell` to the editor root. Leave layout declarations in `AdminShell.module.css` and keep every token value unchanged.

- [ ] **Step 2: Add the reusable page shell**

Create `AdminPageShell` with the theme class, a fixed two-row header, `AdminHeader mode="pages"`, a second-row `Card` containing title and actions, and a scrollable main area. Render loading with `role="status"`, load error with `role="alert"`, otherwise children.

- [ ] **Step 3: Add header modes without duplicating markup**

Extend `AdminHeader` with `mode = "editor"` and `isDirty = false`. In pages mode, render logo, disabled settings, and an active non-navigating page-map tile; omit current page, preview, and publish controls. Add mode-specific CSS classes for the reduced grid.

- [ ] **Step 4: Guard editor navigation**

In editor mode, handle the `/admin/pages` link click. If `isDirty`, call `window.confirm("Есть несохранённые изменения. Перейти к карте страниц?")` and prevent navigation when declined. Pass `isDirty` from `Editor.jsx` through `AdminShell` to `AdminHeader`.

### Task 2: Implement the shared `PageList`

**Files:**
- Create: `editor/PageList.jsx`
- Create: `editor/PageList.module.css`

**Interfaces:**
- Consumes: `PageList({ pages, mode, busyPageId, actionErrorId, onUpdate, onDelete, onRestore })`.
- Callback contracts: `onUpdate(pageId, { title, path }) -> Promise<void>`, `onDelete(page) -> Promise<void>`, `onRestore(pageId) -> Promise<void>`.
- Produces: sorted active or trash rows without network requests.

- [ ] **Step 1: Sort a copied page array**

Implement local sorting with `[...pages].sort`: compare `path.split('/').filter(Boolean).length`, then `path.localeCompare`. Never mutate `pages`.

- [ ] **Step 2: Render one grid for both modes**

Use one list and row structure with named grid areas `path`, `title`, and `actions`. In active display mode, title links to `/admin/pages/:id/edit`; in trash mode render only restore. Do not render tables or per-row cards.

- [ ] **Step 3: Add local inline-edit state**

Store `{ id, originalTitle, originalPath, title, path }`, submission status, and edit error. Clicking Edit focuses the path input, except `/`, where it focuses title. Clicking another Edit is disabled only when current values differ from originals; unchanged editing switches immediately.

- [ ] **Step 4: Implement edit keyboard and request behavior**

Submit on Enter through the form. Handle Escape on the form by canceling, restoring originals, clearing error, and returning focus to that row’s Edit button. Blur does nothing. Disable Save when unchanged or submitting. Await `onUpdate`; close and restore focus on success, retain state and show error on rejection.

- [ ] **Step 5: Preserve row geometry**

Define exact fixed row heights for desktop and mobile. Display text and inputs use identical grid areas; display and edit action groups use the same fixed-width action area. Inputs have constrained heights and `min-width: 0`; labels use ellipsis. Reserve a fixed-height list error area above rows. Mobile uses fixed path/title/action tracks without horizontal overflow.

### Task 3: Rebuild the active page map

**Files:**
- Modify: `editor/Pages.jsx`
- Create: `editor/Pages.module.css`

**Interfaces:**
- Consumes: `AdminPageShell`, `PageList`, existing `/api/pages` POST/PATCH/DELETE endpoints.
- Produces: active page map with create, update, delete, and editor navigation.

- [ ] **Step 1: Retain API ownership and remove global CSS**

Keep existing fetch operations in `Pages.jsx`, remove the `editor.css` import, and render all states through `AdminPageShell`.

- [ ] **Step 2: Adapt PATCH to the PageList callback**

Implement `updatePage(pageId, values)` as an async callback that sends `{ title }` for the original root path and `{ title, path }` otherwise. On success replace title/path in `pages`; on non-OK throw so `PageList` retains its form and values.

- [ ] **Step 3: Adapt DELETE to the PageList callback**

Keep `window.confirm`, root protection, busy state, and local removal. Reject failures so the row remains; expose deleting ID/error ID to `PageList`.

- [ ] **Step 4: Restyle the create form**

Place a compact CSS Module form above `PageList`, focus title when opened, retain entered values on failure, prevent repeated submission, and navigate to the created editor URL on success. The shell toolbar contains Trash and Create controls; cancel closes the form and clears operation status.

### Task 4: Rebuild trash and perform final verification

**Files:**
- Modify: `editor/Trash.jsx`

**Interfaces:**
- Consumes: `AdminPageShell`, `PageList mode="trash"`, existing deleted-list and restore endpoints.
- Produces: trash view sharing the same sorted list and grid.

- [ ] **Step 1: Retain restore ownership and remove global CSS**

Keep the existing GET `/api/pages?deleted=1` and POST restore logic in `Trash.jsx`, remove the `editor.css` import, and render through `AdminPageShell` with a return action.

- [ ] **Step 2: Connect trash mode**

Pass pages, restoring ID, error ID, and async restore callback to `PageList mode="trash"`. Successful restoration removes the row; failure preserves it and shows the shared list error.

- [ ] **Step 3: Run the required diff check once**

Run: `git diff --check`

Expected: exit code 0 and no output.

- [ ] **Step 4: Run the profile build once**

Run: `yarn vyaz:build`

Expected: parts generation and Vyaz public/SSR builds complete without errors.

- [ ] **Step 5: Report manual checks**

Ask the user to verify desktop/mobile row geometry, focus and Escape behavior, dirty-row locking, create, edit, re-sort, delete, restore, root restrictions, and the unsaved-editor navigation warning. Do not run browser or E2E checks.
