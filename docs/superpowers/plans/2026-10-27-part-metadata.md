# Part Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each Kroy part a human-readable title and a catalog category while preserving technical identifiers and page documents.

**Architecture:** Extend the existing JSDoc parser’s result from field schema to complete part metadata. The discovery generator serializes this metadata in `parts.json`; editor consumers read it with deterministic fallbacks for legacy parts. The picker groups filtered entries by category without changing the identifier it returns.

**Tech Stack:** JavaScript, React 19, CSS Modules, Node.js, JSDoc comment-parser.

**Spec:** `docs/superpowers/specs/2026-10-27-part-metadata-design.md`

## Global Constraints

- Keep technical `@kroy/*` identifiers and stored page records `{ part, props }` unchanged.
- Do not add dependencies or duplicate metadata in part `package.json` files.
- Use title derived from the final identifier segment and category `Другое` where annotations are absent.
- Do not create test infrastructure or browser/E2E checks; run `git diff --check` and one `yarn vyaz:build`.

## Review Focus

- A legacy part lacks both annotations: task 1 supplies readable fallback values before metadata reaches UI.
- A search string matches a category but not a title: task 2 retains matching category entries.
- Multiple categories contain filtered entries: task 2 groups only non-empty categories in stable order.
- A page already stores a technical part ID: task 3 uses metadata only for labels and leaves saved data untouched.
- A JSDoc field schema uses nested list paths: task 1 leaves existing `@param` and `@kroy` parsing intact.

---

### Task 1: Parse and generate part metadata

**Files:**
- Modify: `scripts/parsePartDoc.mjs`
- Modify: `scripts/discoverParts.mjs`

**Interfaces:**
- Produces: `parsePartDoc(source) -> { title?, category?, fields }`.
- Produces: `parts.json[identifier] -> { title, category, fields }`.

- [x] **Step 1: Parse `@kroy-title` and `@kroy-category` from the existing JSDoc block**

Keep current field parsing untouched. Return title/category only when their tag descriptions contain a non-empty value.

- [x] **Step 2: Derive metadata fallbacks during part discovery**

Use the last `@kroy/*` segment, replacing hyphens with spaces, as `title`; use `Другое` as `category`; prefer explicit parser values.

- [x] **Step 3: Include title and category in generated `parts.json`**

Retain the existing `fields` shape so all editor form consumers remain compatible.

### Task 2: Group the catalog by category

**Files:**
- Modify: `editor/PartPicker.jsx`
- Modify: `editor/PartPicker.module.css`

**Interfaces:**
- Consumes: generated metadata entries `{ title, category, fields }` and legacy entries containing only `fields`.
- Produces: `onSelect(identifier)` exactly as before.

- [x] **Step 1: Build filtered part entries from metadata and legacy fallbacks**

Search case-insensitively across identifier, title, and category.

- [x] **Step 2: Render non-empty groups in category/name order**

Use the human-readable title as the primary text and retain the technical ID as secondary text. Add compact group headings without changing dialog controls or selection behavior.

### Task 3: Show titles in the page editor

**Files:**
- Modify: `editor/EditorWorkspace.jsx`
- Modify: `editor/PartEditor.jsx`

**Interfaces:**
- Consumes: `metadata[item.part].title` with fallback derived from `item.part`.
- Produces: human-readable titles in persistent part headers and inline property forms.

- [x] **Step 1: Add one local fallback title helper in the editor workspace**

Pass the resolved display title to `PartEditor`; keep all control IDs, component lookup, and content state based on `item.part`.

- [x] **Step 2: Render the resolved title in `PartEditor`**

Remove the technical ID from the form heading; fields and change callbacks remain unchanged.

### Task 4: Part annotations and documentation

**Files:**
- Modify: every component discovered as a part under `parts/`
- Modify: `README.md`
- Modify: `docs/PARTS.md`

- [x] **Step 1: Add title/category tags to all existing parts**

Use concise, generic categories without introducing site-specific content values.

- [x] **Step 2: Document the two annotations and fallback behavior**

State that JSDoc remains the only source for metadata and fields; do not add package manifest field definitions.

### Task 5: Verification

**Files:**
- Modify: none

- [x] **Step 1: Check whitespace**

Run: `git diff --check`

Expected: no output and exit code 0.

- [x] **Step 2: Build once**

Run: `yarn vyaz:build`

Expected: generated registry and Vyaz production build succeed.
