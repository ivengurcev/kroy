# Preview Part Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move add, move, and delete operations from the inspector into the page preview.

**Architecture:** `Editor` retains page state. `EditorWorkspace` composes insertion points, a single portal picker, preview parts, and overlay controls; `BlockInspector` only edits props.

**Tech Stack:** JavaScript, React 19, CSS Modules

**Spec:** `docs/superpowers/specs/2026-10-20-preview-part-management-design.md`

## Global Constraints

- Do not change public parts, API, database, Vyaz, or saved document format.
- Add no dependencies, drag-and-drop, autosave, or history.
- Verify only with `git diff --check` and `yarn vyaz:build`.

## Review Focus

- Exactly `N + 1` insertion points, including an empty page.
- Administrative controls never activate public links or part selection accidentally.
- Popover focus, Escape, outside click, and viewport placement remain usable.
- Stable IDs preserve selection across moves; insertion selects the new part.
- Inspector fields and save serialization behave unchanged.

---

### Task 1: Positional insertion

**Files:** `editor/Editor.jsx`

- [ ] Change `addPart(part, position)` to insert into the requested content index and keep dirty/selection behavior.

### Task 2: Picker and controls

**Files:** `editor/PartPicker.jsx`, `editor/PartPicker.module.css`, `editor/PartControls.jsx`, `editor/PartControls.module.css`

- [ ] Implement the portal picker with filtering, viewport positioning, dismissal, and focus return.
- [ ] Implement accessible overlay move/delete controls with event isolation.

### Task 3: Workspace integration and inspector reduction

**Files:** `editor/EditorWorkspace.jsx`, `editor/EditorWorkspace.module.css`, `editor/BlockInspector.jsx`, `editor/BlockInspector.module.css`

- [ ] Render insertion points around every preview part and one picker at a time.
- [ ] Add overlay controls and preserve content selection/navigation blocking.
- [ ] Remove add/move/delete UI and related props/styles from the inspector.

### Task 4: Verification

- [ ] Run `git diff --check`.
- [ ] Run `yarn vyaz:build` once.
