# Single-row Admin Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-panel Oysite admin header with one compact row that contains navigation, page context, saving, publishing, and preview actions at every supported width.

**Architecture:** `AdminHeader` becomes the single composition owner and receives the existing save state/callback from `AdminShell`. The obsolete `EditorToolbar` is removed; responsive CSS switches the wordmark and labels to a compact `oy` mark and icon-only actions while retaining one nowrap row.

**Tech Stack:** JavaScript, React 19, CSS Modules, existing Oysite UI components and SVG icon system.

**Spec:** `docs/superpowers/specs/2026-10-24-single-row-admin-header-design.md`

## Global Constraints

- Keep one header row at 320–375 px with no wrapping, horizontal scrolling, action menu, or hidden listed actions.
- Preserve the existing page-map navigation and unsaved-changes confirmation.
- Preserve the exact save callback and disabled condition: `loadStatus !== 'success' || !isDirty || saveStatus === 'saving'`.
- Keep settings, page editing, publishing, and preview disabled; do not connect new APIs or imitate completed actions.
- Pages mode keeps logo, settings, page map, publish, and preview; it omits page title, page editing, and saving.
- Do not change the server, database, API, part editor, public sites, page data, or save/revision mechanism.
- Add no dependencies, tests, test infrastructure, or unrelated refactoring.
- Run only `git diff --check` and one `yarn vyaz:build` after implementation.

## Review Focus

- At 320 px, the mark, six editor action icons, and an ellipsized page title fit in one row without overflow.
- Save remains clickable only when the current implementation permits it, including retry after an error.
- A save error is announced with `role="alert"` without reserving width or increasing the header row height.
- Pages mode contains no page-specific title/edit/save controls but retains publish and preview icons.
- Removing `EditorToolbar` leaves no import, route, or generated entry that references its deleted files.

---

### Task 1: Build the unified AdminHeader structure

**Files:**
- Create: `components/admin/OysiteMark.svg`
- Modify: `components/admin/AdminHeader.jsx`

**Interfaces:**
- Extends: `AdminHeader({ mode, page, isDirty, loadStatus, saveStatus, onSave })`.
- Preserves: `mode="pages"`, page-map confirmation, existing disabled actions, and the current full wordmark.
- Produces: one ordered row and a conditional save-error alert.

- [ ] **Step 1: Add the compact inline brand mark**

Create `OysiteMark.svg` from the approved `oy` mark geometry. Use the compact mark viewBox, `currentColor`, and the same `data-accent="true"` group convention as `OysiteLogo.svg`, leaving the source brand-kit assets unchanged.

- [ ] **Step 2: Extend AdminHeader save inputs**

Add defaults suitable for pages mode: `loadStatus`, `saveStatus`, and `onSave`. Compute the accessible save label from current state: loading/unavailable, «Сохранение…», «Сохранено», or «Сохранить». Use the existing disabled expression without altering it.

- [ ] **Step 3: Replace tile markup with one ordered row**

Render full logo and compact mark in the same logo area. Replace settings/page-map tiles with compact action controls containing one icon and one label; keep settings disabled, editor page-map as the existing link/confirmation, and pages-mode page-map as the current `aria-current` item. Remove subtitles, chevrons, home decoration, and page path.

- [ ] **Step 4: Render editor-only page and save controls**

In editor mode render the page title as a flexible ellipsis element, a separate disabled Edit button, and the working Save button using `onSave`, `variant="primary"`, the computed accessible label, and existing disabled rules. Show save progress on the button itself; do not render `StatusIndicator`.

- [ ] **Step 5: Keep site-wide trailing actions in both modes**

Render disabled Publish and Preview controls after the editor-only group in both modes. Keep Publish outline and Preview secondary. Add a conditional compact `role="alert"` save-error notification attached to the header but outside the row width calculation.

### Task 2: Remove EditorToolbar and connect saving through AdminShell

**Files:**
- Modify: `components/admin/AdminShell.jsx`
- Delete: `editor/EditorToolbar.jsx`
- Delete: `editor/EditorToolbar.module.css`

**Interfaces:**
- Consumes: the extended `AdminHeader` props from Task 1.
- Preserves: all existing `AdminShell` inputs and `Editor.jsx` ownership.
- Produces: one header component with the original save callback/state.

- [ ] **Step 1: Pass saving props to AdminHeader**

Remove the `EditorToolbar` import and render from `AdminShell`. Pass `loadStatus`, `saveStatus`, `isDirty`, and `onSave` alongside `page` to the single `AdminHeader`.

- [ ] **Step 2: Remove the obsolete component files**

Delete `EditorToolbar.jsx` and its CSS Module after confirming the repository has no remaining imports. Do not move its disabled tabs, disabled history controls, or `StatusIndicator` into another component.

### Task 3: Implement the one-row responsive layout and verify

**Files:**
- Modify: `components/admin/AdminHeader.module.css`
- Modify: `components/admin/AdminShell.module.css` only if obsolete second-panel spacing remains.

**Interfaces:**
- Consumes: the semantic classes and ordered markup from Task 1.
- Produces: full desktop labels and a one-row icon-only 320–375 px header.

- [ ] **Step 1: Replace the tile grid with a compact nowrap row**

Rewrite `AdminHeader.module.css` around a flex/grid row with natural compact height, `flex-wrap: nowrap`, and no horizontal overflow. Give every action a shared height and remove tile dimensions, subtitles, path styles, chevrons, and multi-row media-query areas. Keep the Card surface/border from the existing header root.

- [ ] **Step 2: Make the page title the only flexible item**

Set the page-title container to `flex: 1 1 auto`, `min-width: 0`, nowrap, and ellipsis. Keep page Edit as a separate fixed-size action. In pages mode use the freed space before Publish/Preview without adding placeholder page controls.

- [ ] **Step 3: Add desktop and compact logo rules**

Show the full wordmark by default and hide the compact mark. At the compact breakpoint reverse them. Keep both inline SVGs colored through the existing text/accent tokens and preserve their aspect ratios.

- [ ] **Step 4: Fit every mobile action at 320 px**

At the mobile breakpoint hide visual action labels, retain `aria-label`, reduce root padding/gaps, and force action buttons/links to approximately 30–32 px square. Keep the compact mark, Settings, Page Map, page title, Edit, Save, Publish, and Preview in the same row. Use `min-width: 0` only for the title; fixed actions must neither shrink away nor wrap.

- [ ] **Step 5: Position save errors outside row sizing**

Make the header root positioned and place the error notification immediately below it with compact admin-token styling and sufficient z-index. It must not change the row height or consume mobile horizontal space.

- [ ] **Step 6: Review modes and widths from declarations**

Read the resulting JSX/CSS for editor and pages modes at 320, 375, 768, and 1440 px. Confirm no listed action has `display: none`, the title owns all flexible compression, and deleted toolbar selectors/imports are absent. Do not launch a browser.

- [ ] **Step 7: Run the required diff check once**

Run: `git diff --check`

Expected: exit code 0 and no output.

- [ ] **Step 8: Run the profile build once**

Run: `yarn vyaz:build`

Expected: parts generation and Vyaz public/SSR builds complete without errors.

- [ ] **Step 9: Report manual checks**

Ask the user to inspect editor/pages headers at 320, 375, 768, and 1440 px; save dirty/saving/success/error states; page-map navigation; ellipsis; and icon accessible names. Do not run browser or E2E checks.
