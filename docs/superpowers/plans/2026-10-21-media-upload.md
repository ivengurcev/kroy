# Media Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add site-isolated immutable image upload, delivery, and editor fields.

**Architecture:** Files live under `data/media/<site-id>` while PostgreSQL records ownership and metadata. Existing Host-based isolation protects both upload and retrieval; `ImageField` plugs into the current recursive field renderer.

**Tech Stack:** JavaScript, React 19, PostgreSQL 17, Hono through Vyaz, Node filesystem

**Spec:** `docs/superpowers/specs/2026-10-21-media-upload-design.md`

## Global Constraints

- JPEG, PNG, and WebP only; 10 MiB maximum; validate magic bytes.
- No dependencies, public-part changes, publication changes, or immediate deletion.
- Verify only with `git diff --check` and `yarn vyaz:build`.

## Review Focus

- Host isolation prevents cross-site reads.
- DB/filesystem failures leave neither partial files nor committed orphan rows.
- Stored paths cannot use user filenames or escape the media root.
- Replacement preserves the old URL until upload succeeds.
- Nested list image fields use the same component and saved string format.

---

### Task 1: Storage schema and primitives

**Files:** migration, `.gitignore`, `media/storage.mjs`

- [ ] Add the `media` table with ownership and immutable-file metadata.
- [ ] Ignore `/data/` and implement signature detection plus safe generated paths.

### Task 2: Media API

**Files:** `api/postMedia.mjs`, `api/getMedia.mjs`, `server.mjs`

- [ ] Implement transactional upload and cleanup.
- [ ] Implement domain-isolated immutable retrieval.
- [ ] Register POST and GET routes.

### Task 3: Editor field

**Files:** `editor/ImageField.jsx`, `editor/ImageField.module.css`, `editor/Field.jsx`

- [ ] Implement upload, preview, replace, progress, and error states.
- [ ] Route image schemas through `ImageField`.

### Task 4: Verification

- [ ] Run `git diff --check`.
- [ ] Run `yarn vyaz:build` once.
