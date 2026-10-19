# Editor Interface Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old editor UI with the new administrative shell while preserving page loading, part editing, ordering, and race-safe saving.

**Architecture:** `Editor.jsx` remains the single stateful controller and passes page data and callbacks into presentation components under `editor/layout-preview/`. The shell renders real parts through `Page`, while `PartEditor`, `Field`, and `ListField` continue to own metadata-driven controls and receive isolated CSS Module styling.

**Tech Stack:** JavaScript, React 19, CSS Modules, Vyaz, existing Kroy API and generated parts registry.

**Spec:** `docs/superpowers/specs/2026-10-18-editor-interface-integration-design.md`

## Global Constraints

- Keep stored page JSON limited to `{ part, props }`; editor-only IDs never reach the API.
- Do not change PostgreSQL, API contracts, Vyaz, public site styles, or the site builder.
- Add no dependencies and no new editor capabilities.
- Keep `Editor.jsx` as the owner of all page state and mutations.
- Do not create tests or test infrastructure; run only the two checks required by `AGENTS.md` after all tasks.
- Preserve `/admin`, `/admin/pages`, `/admin/pages/trash`, and `/admin/pages/:pageId/edit` behavior.

## Review Focus

- A page with empty `content` must show an empty inspector state while still allowing a part to be added.
- Removing the first, middle, or final selected part must choose the correct surviving neighbor or clear selection.
- Editing during an in-flight save must leave the editor dirty after the older request succeeds.
- A link inside a rendered part must select its block without navigating away from the editor.
- List metadata fields must retain add, remove, reorder, and nested field editing behavior under CSS Modules.

---

### Task 1: Make `Editor.jsx` the controller for the new shell

**Files:**
- Modify: `editor/Editor.jsx`

**Interfaces:**
- Consumes: `createPart(part, fields, props)`, generated `parts`, generated `metadata`, existing GET and PUT page endpoints.
- Produces: `<AdminShell page content metadata parts selectedPartId loadStatus saveStatus isDirty onSelectPart onAddPart onRemovePart onMovePart onPropChange onSave />`.

- [ ] **Step 1: Replace old UI imports**

Remove the `editor.css` and `PartsPanel` imports. Import `AdminShell` from `editor/layout-preview/AdminShell.jsx`. Keep `Page` out of `Editor.jsx`; rendering belongs to `EditorWorkspace`.

- [ ] **Step 2: Store complete page and selection state**

Store `{ id, title, path }` from the GET response, plus `selectedPartId`, `isDirty`, and a mutable revision counter. On load, map content through `createPart`, select the first resulting ID or `null`, set `isDirty` to `false`, and expose the successful state as saved.

- [ ] **Step 3: Centralize the mutation marker**

Add one local helper used by `addPart`, `removePart`, `movePart`, and `updateProp` that increments the revision and sets `isDirty = true`. It must not replace the existing immutable `setContent` updates.

- [ ] **Step 4: Preserve selection across operations**

Create a new part before calling `setContent`, append it, and select its ID. For removal, calculate the selected item’s current index before filtering; when the removed ID is selected, choose the item at the same index in the remaining array, otherwise the previous final item, otherwise `null`. Moving and property updates retain `selectedPartId` unchanged.

- [ ] **Step 5: Make save completion revision-aware**

At save start, capture both the cleaned `pageContent` snapshot and the current revision. Send the captured snapshot. On success, clear `isDirty` only when the latest revision still equals the captured revision; otherwise restore the idle request state while retaining `isDirty = true`. On error, set the error request state and retain `isDirty`.

- [ ] **Step 6: Render only `AdminShell`**

Pass all state and callbacks through the interface above. Loading and error are props rather than early returns so the new shell owns the visual states. Do not retain old sidebar, result, JSON, or save-bar markup.

### Task 2: Connect the administrative shell to real editor data

**Files:**
- Modify: `editor/layout-preview/AdminShell.jsx`
- Modify: `editor/layout-preview/AdminHeader.jsx`
- Modify: `editor/layout-preview/EditorToolbar.jsx`
- Modify: `editor/layout-preview/EditorWorkspace.jsx`
- Modify: `editor/layout-preview/BlockInspector.jsx`
- Modify: `editor/layout-preview/AdminShell.module.css`

**Interfaces:**
- Consumes: the `AdminShell` props produced by Task 1 and existing `Page`/`PartEditor` components.
- Produces: a presentation-only editor shell with real preview, selection, fields, operations, page identity, and save status.

- [ ] **Step 1: Define `AdminShell` prop flow**

Accept the Task 1 interface and forward only relevant props: page identity to `AdminHeader`; request/dirty state and save callback to `EditorToolbar`; content, registry, metadata, selection, and part callbacks to `EditorWorkspace`. Render scoped loading or error content in the workspace area without fake page data.

- [ ] **Step 2: Connect header identity and page navigation**

Render `page.title` and `page.path` in `AdminHeader`. Replace the disabled map tile with an anchor to `/admin/pages` styled as the existing tile. Keep settings, path editing, preview, and publish controls disabled.

- [ ] **Step 3: Map real save states in the toolbar**

Derive the visible label with this priority: `saving`, `error`, `isDirty`, saved. Connect the primary save button to `onSave`; disable it when loading failed, saving is active, or `isDirty` is false. Leave history controls disabled.

- [ ] **Step 4: Render selectable real parts**

Replace all mock sections in `EditorWorkspace` with `content.map`. For each item render `<Page content={[item]} parts={parts} />` inside a keyed selection container. On container click, call `onSelectPart(item.id)`; if the click originated in an anchor, call `preventDefault()` before selection. Apply the selected class only to the active container and never style its descendants.

- [ ] **Step 5: Replace the static inspector form**

Find the selected item from `content` and pass it to `BlockInspector`. The inspector keeps a local choice of available part name only for the add picker. Adding calls `onAddPart(name)`. For a selected item, show part name, move up/down buttons with boundary disabling, remove action, and `PartEditor` wired to `onPropChange(selected.id, name, value)`. Without selection, show the empty-state copy and add controls.

- [ ] **Step 6: Remove obsolete placeholder styling**

Delete mock hero/content/row/image classes and add only scoped styles for loading/error states, part selection wrappers, add controls, inspector actions, and empty state. Reuse existing tokens and UI components; do not apply inherited typography, spacing, or element selectors inside rendered public parts.

### Task 3: Isolate metadata-driven editor fields

**Files:**
- Modify: `editor/PartEditor.jsx`
- Modify: `editor/Field.jsx`
- Modify: `editor/ListField.jsx`
- Create: `editor/PartEditor.module.css`
- Create: `editor/Field.module.css`
- Create: `editor/ListField.module.css`

**Interfaces:**
- Consumes: existing `PartEditor({ part, props, fields, onPropChange })`, `Field({ name, schema, value, onChange })`, and `ListField` props without signature changes.
- Produces: the same field behavior with no dependency on old editor global classes.

- [ ] **Step 1: Add module styling to `PartEditor`**

Replace `part-editor` with a module class and style only the section heading and vertical field layout using inherited admin tokens.

- [ ] **Step 2: Add module styling to scalar fields**

Replace `part-field` and `checkbox-field` with module classes. Style inputs, textareas, and selects within those local classes while preserving all current values, validators, and change handlers.

- [ ] **Step 3: Add module styling to list fields**

Replace `list-field`, `list-item`, and `list-actions` with module classes. Preserve recursive `FieldComponent` rendering and all add/remove/move handlers unchanged.

### Task 4: Remove the temporary parallel interface and verify

**Files:**
- Modify: `server.mjs`
- Delete: `editor/layout-preview/LayoutPreview.jsx`
- Delete: `editor/PartsPanel.jsx`

**Interfaces:**
- Consumes: integrated `Editor.jsx` from Tasks 1–3.
- Produces: one editor implementation reachable only through the established editor routes.

- [ ] **Step 1: Remove the temporary route**

Delete `/admin/layout-preview` from `server.mjs`. Keep all other routes unchanged.

- [ ] **Step 2: Remove obsolete entry components**

Delete `LayoutPreview.jsx` and the now-unreferenced `PartsPanel.jsx`. Keep `editor.css` because `Pages.jsx` and `Trash.jsx` still import it.

- [ ] **Step 3: Check the complete diff once**

Run: `git diff --check`

Expected: no output and exit code 0.

- [ ] **Step 4: Build the Vyaz application once**

Run: `yarn vyaz:build`

Expected: parts generation completes and both public and SSR builds finish without errors.

- [ ] **Step 5: Report manual checks**

List these browser checks for the user without running them: initial saved state, block selection, prevented link navigation, scalar/list edits, add/remove/reorder selection, clean save, edit-during-save race, reload persistence, and both editor URLs.
