# Admin Component Structure and Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the existing Kroy administrative UI by responsibility and replace scattered symbols with one accessible SVG icon component without changing behavior.

**Architecture:** Route entries live in `pages/`, reusable presentation in `components/ui/`, shared administrative composition in `components/admin/`, and content-editing components in `editor/`. `EditorPage` is deliberately a thin wrapper so `Editor.jsx` retains its current state ownership.

**Tech Stack:** JavaScript, React 19, CSS Modules, Vyaz, esbuild

**Spec:** `docs/superpowers/specs/2026-10-20-admin-component-structure-and-icons-design.md`

## Global Constraints

- Preserve all current routes and behavior.
- Do not change API, PostgreSQL, Vyaz, public sites, or build-site code.
- Add no dependencies and keep JavaScript + React + CSS Modules.
- Run only `git diff --check` and one `yarn vyaz:build`; add no test infrastructure.

## Review Focus

- Every moved import resolves under Yarn PnP/esbuild.
- CSS Module ownership changes do not drop selectors or token scope.
- All formerly typographic action icons use `Icon` and accessible icon-only buttons retain labels.
- Page and trash operations retain the same callbacks and state transitions.
- Editor dirty-navigation warning, selection, mutation, and save behavior remain unchanged.

---

### Task 1: Move shared UI and add Icon

**Files:**
- Move: `editor/layout-preview/ui/*` to `components/ui/`
- Create: `components/ui/Icon.jsx`
- Create: `components/ui/Icon.module.css`

**Interfaces:**
- Produces: `Icon({ name, size, className })` and unchanged existing UI component APIs.

- [ ] Move the existing UI files without changing their public props.
- [ ] Add the centralized SVG icon map and shared SVG styling.
- [ ] Update UI-internal relative imports, if any.

### Task 2: Move administrative shells and split their styles

**Files:**
- Move: `AdminHeader`, `AdminShell`, `AdminPageShell`, and `PageList` to `components/admin/`
- Create/modify: colocated CSS Modules for those components
- Move: `editor/layout-preview/AdminTheme.module.css` to `styles/AdminTheme.module.css`

**Interfaces:**
- Consumes: UI components and `Icon` from Task 1.
- Produces: unchanged shell and list props for route pages and `Editor`.

- [ ] Move the shared administrative components and token module.
- [ ] Split header/shell/page-list selectors by component ownership while retaining values.
- [ ] Replace header and page-list action symbols with named `Icon` instances.

### Task 3: Move editor-specific presentation

**Files:**
- Move: `EditorToolbar`, `EditorWorkspace`, `EditorFooter`, and `BlockInspector` to `editor/`
- Create/modify: their colocated CSS Modules
- Modify: `editor/Editor.jsx`, `editor/ListField.jsx`

**Interfaces:**
- Consumes: shells, UI components, and `Icon` from Tasks 1–2.
- Produces: the same props and callbacks currently consumed by `Editor.jsx`.

- [ ] Move editor presentation components and distribute their existing selectors.
- [ ] Replace toolbar, inspector, list movement, save, and device symbols with `Icon`.
- [ ] Update `Editor.jsx` imports without changing state or operations.

### Task 4: Create route pages and remove temporary structure

**Files:**
- Create: `pages/EditorPage.jsx`
- Move: `editor/Pages.jsx` to `pages/PagesPage.jsx`
- Move: `editor/Trash.jsx` to `pages/TrashPage.jsx`
- Move/rename: `editor/Pages.module.css` to a colocated page module
- Modify: `server.mjs`
- Remove: `editor/layout-preview/` after all consumers are migrated

**Interfaces:**
- Consumes: components from Tasks 1–3.
- Produces: route components referenced by `server.mjs`.

- [ ] Add the thin `EditorPage` wrapper.
- [ ] Move page/trash owners and update imports without changing request logic.
- [ ] Point all administrative routes at `pages/*Page.jsx`.
- [ ] Confirm no source import references `layout-preview`, then remove the empty directory.

### Task 5: Technical verification

**Files:**
- Modify only files required to correct verification failures caused by this refactor.

- [ ] Run `git diff --check`; expect no output and exit code 0.
- [ ] Run `yarn vyaz:build`; expect successful client and server builds.
- [ ] Inspect the final diff for changes outside the approved directories and report manual browser checks.
