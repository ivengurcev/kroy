# Administrative Frontend Directory Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Do not commit.

**Goal:** Move the administrative frontend into a top-level `admin/` directory without changing runtime behavior or public routes.

**Architecture:** Move admin route pages, editor UI, admin components, UI components, and the admin theme with their styles, assets, and tests. Keep `server.mjs` at root, and keep `editor/partModel.js` plus its tests at root because API and CLI migration code consume it.

**Tech Stack:** JavaScript, React 19, CSS Modules, Vyaz/esbuild, Yarn 4.

**Spec:** User-provided task, `# Task: Reorganize the administrative frontend into admin/`.

## Global Constraints

- Preserve application behavior, route paths, and API contracts.
- Do not reorganize `api/`, `db/`, `layout/`, `parts/`, `widgets/`, `payments/`, `media/`, `scripts/`, `themes/`, or `infra/`.
- Keep JavaScript, add no dependencies, do not edit `dist/`, and do not commit or push.
- Run reference checks, `git diff --check`, and one `yarn vyaz:build`; do not run browser/E2E checks.

## Review Focus

- Root route component strings and layout settings must resolve under `admin/`; check by searching for old paths and building.
- Admin-relative imports, CSS, SVGs, and test fixtures must resolve; check with source reference search and build.
- Shared `editor/partModel.js` consumers must remain at root; check API/CLI imports remain unchanged.
- Public rendering and SSG inputs must not acquire admin imports; inspect public entry references and run the build.
- Public URL paths must remain unchanged; review `server.mjs` route declarations.

## File Structure

- `admin/pages/`: all current route pages and adjacent modules/tests.
- `admin/editor/`: editor UI modules and adjacent modules/tests, except shared `partModel.js` and `partModel.test.mjs`.
- `admin/components/`: contents of current `components/admin/`.
- `admin/ui/`: contents of current `components/ui/`.
- `admin/styles/AdminTheme.module.css`: current admin theme.
- Root `editor/partModel.js` and its test remain for API/CLI consumers.

## Tasks

### Task 1: Move admin-only frontend files

**Files:** Move `pages/*` to `admin/pages/`; move editor UI files from `editor/` to `admin/editor/` except `partModel.js` and `partModel.test.mjs`; move `components/admin/*` to `admin/components/`; move `components/ui/*` to `admin/ui/`; move `styles/AdminTheme.module.css` to `admin/styles/`.

- [ ] Preserve filenames and colocated assets, styles, and tests.
- [ ] Leave `styles/SiteTheme.module.css` and shared `editor/partModel*` in place.

### Task 2: Update references and documentation

**Files:** `server.mjs`, moved JS/JSX/CSS modules and test fixtures, `docs/architecture.md`, `docs/EDITOR.md`, `AGENTS.md`, `README.md` if it documents old paths.

- [ ] Update root configuration strings for layout and route component files without changing route paths.
- [ ] Update relative imports and test fixture import strings to new locations.
- [ ] Update architecture/editor docs and AGENTS layout guidance; update README only if it contains stale paths.
- [ ] Search for remaining references to old frontend paths.

### Task 3: Verify

- [ ] Run `git diff --check` via git-manager.
- [ ] Run `yarn vyaz:build` once in the documented environment.
- [ ] Report build/test status and any environment limitation; do not run browser/E2E checks.
