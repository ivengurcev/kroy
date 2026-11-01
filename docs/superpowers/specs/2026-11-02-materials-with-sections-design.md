# Materials with Sections — Design

## Intent

Replace the article-only content model with user-created material sections and
materials. Pages choose a section for each material list; the chosen section
scopes list previews and generated detail pages. Existing Lexical editing,
covers, draft/publication behavior, static URLs, and route conflict checks stay
in place.

## Goals

- Store site-scoped `material_sections` and `materials` with database-enforced
  ownership and section membership.
- Provide section CRUD and material CRUD in the existing admin UI. A section
  with materials or a Pages list reference cannot be deleted; return a clear
  error instead of cascading content or routes.
- Replace the Pages source `articles` with `materials`; require a section for
  each material list. Detail pages inherit their parent list's section.
- Allow at most one active dynamic material-list Page per section, so normal-page
  material-list blocks have one unambiguous detail route to link to.
- Filter material lists, previews, and static detail generation by section.
- Allow a normal page's material-list part to select a section explicitly.
- Keep section names/slugs out of automatic public routing. Paths remain owned
  by Pages and existing resolved-route conflict checks remain authoritative.
- Replace article APIs, parts, widgets, UI and tests without compatibility
  shims. Update the schema snapshot and relevant documentation.

## Non-goals and constraints

- No `faq`, `cases`, `articles`, or nested section entities.
- No special FAQ editor or section-generated public URLs.
- No changes to product catalog, reviews, payment flows, or the Pages
  list/detail architecture beyond section association.
- No data backfill is needed: the user confirmed old article data need not be
  preserved. Existing migrations remain immutable; a new migration drops the
  old `articles` table and installs the replacement schema without copying rows.
- Pages may still contain `data_source='articles'` or old article part/widget
  identifiers even when the article table is empty. Before changing schema, the
  new migration must detect those references and abort with a clear message.
  It must not delete or silently convert Pages, or create a section on the
  user's behalf; the references require explicit cleanup before retrying.
- Keep the current JavaScript, Bun, Hono, React, PostgreSQL, esbuild and Lexical
  stack and current visual design.

## Approaches

1. **Store section on the Pages list row (selected).** Add nullable
   `pages.material_section_id`; require it only when `page_type='list'` and
   `data_source='materials'`. A composite foreign key ties it to the same
   `site_id`. Detail pages inherit through `detail_parent_id`. This matches the
   current normalized `page_type`/`data_source` columns and enforces ownership
   in PostgreSQL.
2. **Store source configuration in JSON on Pages.** This avoids a dedicated
   column but introduces a second Page configuration format and requires
   application-only validation for section ownership. It is unnecessary for
   the one selected source parameter.

The user approved approach 1. Section selection for ordinary-page parts stays
in that part's props; dynamic list parts use the Page's section automatically.

## Data model and migration

- Create `material_sections(id, site_id, name, slug, sort_order)`, unique by
  `(site_id, id)` and `(site_id, slug)`.
- Create `materials(id, site_id, section_id, slug, title, summary, content,
  cover_media_id, status, created_at, updated_at, published_at)`. Use a
  composite `(site_id, section_id)` foreign key to prevent cross-site section
  links and a unique `(site_id, section_id, slug)` index. Preserve article
  status/content checks and cover-media behavior.
- Add `pages.material_section_id`, with a composite same-site foreign key.
  The page type check requires a section for material lists and forbids it for
  standard pages, other list sources, and detail pages. Use restrictive delete
  behavior so referenced sections cannot disappear. Add a partial unique index
  for `(site_id, material_section_id)` on non-deleted material-list pages.
- In one new migration, replace the empty `articles` table and update the Pages
  check/source constraint. Do not edit applied migrations. Bring
  `db/schema.sql` to the resulting schema. Check for legacy article list sources
  and article/article-list blocks before any destructive DDL, and fail the
  migration with a clear precondition message if any are found.

## Application behavior

- Replace article persistence and API modules with section/material modules.
  Scope every query by the current site. Validate a section belongs to the
  current site on create and section changes; update section membership and
  material fields in the same transaction. Keep slug uniqueness section-local.
- Section delete checks both material usage and Pages-list usage and responds
  with a clear conflict message. Section ordering uses `sort_order`.
- Add a Materials admin entry with a section list/tree and a section's materials
  view. Reuse existing controls, styles, Lexical editor, cover upload and status
  filters. Section forms edit name, internal slug and order. Material editor
  supports choosing/changing section.
- Pages create/edit sends `dataSource='materials'` and required
  `materialSectionId`; server checks site ownership. Detail-page records keep no
  section column value and get the section from their parent list.
- Replace article parts/widgets with material equivalents. Their contracts
  retain the current prepare-data/render-widget split. A regular-page list part
  has a dynamic section picker; on a material list page the Page section takes
  precedence, with no second selection. A regular-page block uses the sole
  Pages list for its selected section's detail template; if no such list exists,
  render cards without links as the current no-template behavior does.
- Preview APIs return section-scoped records. The preview of a detail template
  chooses a published material from its parent's section.
- SSG queries and attaches published data by section. Each detail template
  expands only materials of its parent list's section. Duplicate slugs across
  sections are valid until their resolved public paths collide; existing page,
  redirect, deleted-path and detail-path conflict validation still rejects
  those collisions. Covers remain site-owned and public output contains no
  drafts.
- Remove old route/API/component names, stale article tests and docs; document
  the Materials/Pages relationship and stable URL ownership.

## Verification

Add or update tests for section/material creation, cross-site rejection,
section moves, section-scoped filtering, multiple section lists, section-scoped
detail generation, same slug in separate sections, resolved path collisions,
and build/publication output. Run the existing relevant suite and the Bun site
build. Do not deploy, commit or push.
