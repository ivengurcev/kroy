# Catalog and Compact Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve catalog creation/editing UX and apply shared compact form layout without changing API or data model.

**Architecture:** Keep catalog state in `SitePage` and make `CatalogEditor` responsible only for local tree/editor presentation. Extend existing form primitives/styles rather than introducing a second form system.

**Tech Stack:** React, CSS Modules, existing Kroy UI components, PostgreSQL normalization module.

**Spec:** `docs/superpowers/specs/2026-10-28-catalog-forms-design.md`

## Global Constraints

- No new dependencies.
- Do not change API, DB schema, page format, or public product parts.
- Keep unsaved local state after validation errors and mobile navigation.
- Do not create separate mobile business logic.

## Review Focus

- Empty category/product names must return an error without deleting the local draft — `db/catalog.mjs` and `SitePage` save path.
- Category-local product creation must retain `categoryId` — `CatalogEditor`.
- Mobile selection/back navigation must preserve the selected editor and draft — `CatalogEditor`.
- Compact fields must remain usable at 320 px and leave long controls vertical — shared form CSS.
- Existing list menus and specialized token controls must keep their behavior — affected component smoke/build check.

### Task 1: Validate catalog payloads

**Files:**
- Modify: `db/catalog.mjs`

- [ ] Reject missing/blank category and product names with explicit errors instead of filtering them.
- [ ] Preserve existing valid normalization and transaction behavior.
- [ ] Run `node --check db/catalog.mjs`.

### Task 2: Catalog tree/editor UX

**Files:**
- Modify: `components/admin/CatalogEditor.jsx`
- Modify: `components/admin/CatalogEditor.module.css`

- [ ] Add category-row `+` action that creates a product with the category ID and selects it.
- [ ] Replace always-visible move controls with a per-row actions menu containing move/delete actions.
- [ ] Add mobile tree/editor mode and a back button without changing `value/onChange` semantics.
- [ ] Keep category changes reflected immediately in the tree.

### Task 3: Shared compact forms

**Files:**
- Modify: `components/ui/FormField.jsx`
- Modify: `components/ui/FormField.module.css`
- Modify: `components/admin/CatalogEditor.jsx`
- Modify: `components/admin/CatalogEditor.module.css`
- Modify: `components/admin/SocialLinksEditor.module.css`
- Modify: `pages/SitePage.module.css`
- Modify: `components/admin/PageDetailsForm.module.css`
- Modify: `editor/Field.module.css`

- [ ] Add reusable compact field presentation for short controls.
- [ ] Apply it to catalog/contact/social/page/property forms while keeping textarea/image/token tables vertical.
- [ ] Preserve labels, help/errors, control dimensions, and mobile fallback.

### Task 4: Verification

- [ ] Run `git diff --check`.
- [ ] Run `yarn vyaz:build`.
- [ ] Inspect diff for API/schema/public-part changes.
