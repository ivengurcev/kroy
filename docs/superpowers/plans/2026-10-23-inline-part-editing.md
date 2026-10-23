# Inline Part Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the permanent part inspector with one inline property form rendered in place of the active public part while preserving all existing page-content operations and saved data.

**Architecture:** `Editor.jsx` remains the page-state owner. `EditorWorkspace` adds local `editingPartId`, reuses `PartEditor` for the active item, and delegates every property update to the existing callback; `AdminShell` moves the footer into the scroll flow and the workspace becomes one column.

**Tech Stack:** JavaScript, React 19, CSS Modules, existing Oysite admin UI, existing Kroy part metadata and editor fields.

**Spec:** `docs/superpowers/specs/2026-10-23-inline-part-editing-design.md`

## Global Constraints

- Keep `Editor.jsx` as owner of content, dirty/save state, selection, and persistence.
- Keep saved page content exactly `{ part, props }`; never add `editingPartId` or administrative IDs to persisted data.
- Reuse `PartEditor`, `Field`, `ListField`, `ImageField`, and existing JSDoc metadata without behavior changes.
- Preserve part insertion, picker behavior, selection, moving, deletion, multiple instances, and manual page saving.
- Do not change APIs, PostgreSQL, the JSDoc parser, part format, build mechanism, public rendering, autosave, history, or view modes.
- Add no dependencies, tests, test infrastructure, separate mobile implementation, or unrelated refactoring.
- Run only `git diff --check` and one `yarn vyaz:build` after implementation.

## Review Focus

- Opening a second part closes the first inline form without losing property changes already written to page state.
- Deleting the part currently being edited removes the form and leaves no stale active editor.
- Moving an edited part preserves its open form because identity is based on the existing internal part ID.
- Nested `ListField` state remains attached to the correct part and updates through the existing callback.
- At 375 px, inline fields and controls stay inside the page without overlapping adjacent parts or creating horizontal document scrolling.

---

### Task 1: Add inline editing to part previews

**Files:**
- Modify: `editor/EditorWorkspace.jsx`
- Modify: `editor/EditorWorkspace.module.css`
- Modify: `editor/PartControls.jsx`
- Modify: `editor/PartControls.module.css`

**Interfaces:**
- Preserves: all current `EditorWorkspace` props and `PartControls` move/delete behavior.
- Extends: `PartControls` with `onEdit(partId)`.
- Produces: local `editingPartId` and an inline `PartEditor` for exactly one part.

- [ ] **Step 1: Add the edit action to PartControls**

Add required `onEdit` to `PartControls`. Render a signed «Редактировать» compact button with `Icon name="edit"` before move/delete controls. Its click handler prevents default, stops propagation, and calls `onEdit(partId)`. Keep existing move and delete handlers unchanged; adjust the control CSS only enough for the signed button to fit and remain usable at narrow widths.

- [ ] **Step 2: Add local editing identity**

In `EditorWorkspace`, initialize `editingPartId` with `useState(null)`. Implement `editPart(id)` to call `onSelectPart(id)` and set that ID. Implement `closePartEditor()` to set null. Do not lift this state to `Editor.jsx` and do not copy part props into local state.

- [ ] **Step 3: Close editing when the active part is deleted**

Add a local remove wrapper that clears `editingPartId` only when it equals the removed ID, then calls the existing `onRemovePart(id)`. Pass that wrapper to `PartControls`; moving and property changes keep the editor open.

- [ ] **Step 4: Render public content or the existing property editor**

Remove the `BlockInspector` import and render. Import `PartEditor`. For each item, keep the same outer preview container and `PartControls`; when its ID is active, replace only the `SiteRoot`/`Page` content with an administrative inline panel containing the part identifier, a «Закрыть» button, and `PartEditor`. Pass current props, `metadata[item.part]?.fields ?? {}`, and an `onPropChange` closure calling `onPropChange(item.id, name, value)`. For inactive items retain the current inert public preview exactly.

- [ ] **Step 5: Style the inline panel in normal flow**

Make the workspace one column and remove inspector-width dependence. Add inline panel, header, title, body, and close-control rules in `EditorWorkspace.module.css`. Use admin tokens, visible border/background, responsive padding, `min-width: 0`, and a centered inner maximum width suitable for forms. Keep the outer part container in normal flow and retain selection, controls, and insertion-point styles.

### Task 2: Move the footer after content and verify

**Files:**
- Modify: `components/admin/AdminShell.jsx`
- Modify: `components/admin/AdminShell.module.css`
- Modify: `editor/EditorFooter.module.css`

**Interfaces:**
- Preserves: `AdminShell` props, header/toolbar behavior, and the sole scrolling `main` region.
- Produces: a two-row root shell with `EditorFooter` after `EditorWorkspace` inside `main`.

- [ ] **Step 1: Move EditorFooter into main**

In `AdminShell.jsx`, render `<EditorFooter />` immediately after `EditorWorkspace` inside `.scrollArea`. Remove the old footer sibling after `main`; do not change `EditorFooter` markup or functionality.

- [ ] **Step 2: Convert the shell to two rows**

Change `AdminShell.module.css` to `grid-template-rows: auto minmax(0, 1fr)`. Keep the existing full-screen root, natural header height, and `main` as the only scroll owner. Do not introduce fixed footer offsets or another scroll container.

- [ ] **Step 3: Restyle the footer as flow content**

Remove viewport-oriented margins and z-index assumptions from `EditorFooter.module.css`. Give the footer normal top/bottom spacing inside `main`, preserve its centered segmented control, and keep responsive horizontal spacing without sticky or fixed positioning.

- [ ] **Step 4: Review state and layout invariants**

Read the final flow from `Editor.jsx` through `AdminShell` and `EditorWorkspace`: verify `editingPartId` is never passed to persistence, every property edit still reaches `updateProp`, inactive parts remain inert, move/add/delete callbacks remain connected, and no `BlockInspector` column remains. Review CSS declarations for 375, 768, and 1440 px without launching a browser.

- [ ] **Step 5: Run the required diff check once**

Run: `git diff --check`

Expected: exit code 0 and no output.

- [ ] **Step 6: Run the profile build once**

Run: `yarn vyaz:build`

Expected: parts generation and Vyaz public/SSR builds complete without errors.

- [ ] **Step 7: Report manual checks**

Ask the user to verify normal previews, opening/closing/switching inline editors, immediate updates, nested lists, add/move/delete operations, saved JSON shape, and 375/768/1440 px layouts. Do not run browser or E2E checks.
