# Materials with Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Kroy's article model with site-scoped material sections and materials, and make Pages, widgets, previews, and publication consistently use the selected section.

**Architecture:** Store a material section on each active material-list Page in `pages.material_section_id`, enforced by same-site foreign keys and a one-active-list-per-section index. User-created sections own materials; detail Pages inherit their parent's section, while ordinary-page material list blocks choose a section in block props and use its sole Pages list for detail links.

**Tech Stack:** Bun 1.4.4, JavaScript, Hono, React, PostgreSQL/dbmate, esbuild, Lexical.

**Spec:** `docs/superpowers/specs/2026-11-02-materials-with-sections-design.md`

## Global Constraints

- Do not preserve or backfill old `articles` table rows; the migration drops the table.
- Do not edit already-applied migrations; add a new migration and update `db/schema.sql`.
- Before destructive migration DDL, abort with a clear message if Pages still use the `articles` source or old article part/widget IDs.
- A material belongs to one section on the same site; material slug uniqueness is `(site_id, section_id, slug)`.
- Every active material-list Page requires a section, and one section may have at most one active material-list Page.
- Detail Pages inherit section through `detail_parent_id`; section names/slugs never create public routes.
- Preserve the part-data/widget-render split, existing Lexical editor, covers, status filters, URL parameters, route conflict checks, and visual design.
- Do not add FAQ/case/article-specific entities, nested sections, compatibility APIs/components, or changes to catalog/reviews/payments.
- Do not deploy to VPS, commit, or push.

## File Map

- `db/migrations/`, `db/schema.sql`, `db/articles.mjs`: replace article storage and add section/material repositories.
- `server/api/articles.mjs`, `server.mjs`: replace article API and route registrations; add section CRUD.
- `admin/pages/SiteArticlesPage.jsx`, `SiteArticleEditorPage.jsx`, `SiteSettingsLayout.jsx`: replace article screens/navigation with section/material management.
- `shared/pageDataSources.mjs`, `admin/pages/PagesPage.jsx`, `admin/components/PageDetailsForm.jsx`, `server/api/postPage.mjs`, `patchPage.mjs`, `getPage.mjs`: select and persist the material section on Pages.
- `site/parts/article*`, `site/widgets/article-*`, `site/runtime/articleListData.mjs`, `site/runtime/Page.jsx`: replace article parts/widgets and pass section-scoped data.
- `admin/editor/`, `build/registry/`: add a dynamic section picker for a list block on an ordinary page.
- `server/api/getSitePreview.mjs`, `admin/editor/articlePreview.mjs`, `build/site/`: scope preview, static lists, detail pages, and publish output to sections.
- Article-specific tests and `docs/requirements.md`, `docs/architecture.md`, `docs/arch-rules.md`, `docs/PARTS.md`, `docs/ROUTING.md`: replace stale names and document the new contracts.

## Review Focus

- **Cross-site section IDs:** material/page APIs reject a section from another site, and composite FKs enforce the same boundary even for direct SQL. Test in Task 1 and Task 2.
- **Section deletion with retained references:** materials and Pages in trash still prevent deleting their section; return a clear conflict. Test in Task 2.
- **Section uniqueness and trashed Pages:** only one non-deleted list Page may use a section; trashed list Pages do not prevent creating a replacement. Test in Task 4.
- **Duplicate slugs and resolved routes:** identical slugs in different sections are allowed, but equal resolved URLs across Pages/templates/redirects are rejected. Test in Task 6.
- **Ordinary-page list links:** use the unique active list's detail template and render without links when the section has no list Page. Test in Task 5 and Task 6.

---

### Task 1: Material schema, migration, and database repositories

**Files:**
- Create: `db/migrations/202611020001_replace_articles_with_materials.sql`
- Create: `db/materialSections.mjs`, `db/materials.mjs`
- Test: `db/materialSections.integration.test.mjs`, `db/materials.integration.test.mjs`
- Modify: `db/schema.sql`
- Delete: `db/articles.mjs`

**Interfaces:**
- `getMaterialSections(siteId)`, `createMaterialSection(siteId, input)`, `updateMaterialSection(siteId, id, changes)`, `deleteMaterialSection(siteId, id)`.
- `getMaterials(siteId, { sectionId })`, `getMaterial(siteId, id, client, options)`, `createMaterial(siteId, input)`, `updateMaterial(siteId, id, changes, client)`, `deleteMaterial(siteId, id)`.
- Repository objects use camelCase names (`sectionId`, `coverMediaId`, `createdAt`, `publishedAt`) and scope every query by `siteId`.

- [ ] **Step 1: Add guarded migration and repository integration cases.** Cover section/material creation, same-site FK enforcement, section-local slug uniqueness, moving a material, and migration refusal when Pages contain old article sources or block IDs. Assert migration refusal occurs before dropping `articles` or changing Pages constraints.
- [ ] **Step 2: Run the targeted database tests against an isolated migration test database.** Expected: new behavior cases fail before the schema/repositories exist; migration guard case fails until the new precondition is implemented.
- [ ] **Step 3: Implement the migration.** Create `material_sections` with `(site_id, id)` and `(site_id, slug)` uniqueness; create `materials` with `(site_id, section_id, slug)` uniqueness, same-site composite section FK, Lexical/status/published checks, and existing cover-media semantics. Add `pages.material_section_id`, same-site FK, material-list check rules, and the partial unique index for non-deleted material-list Pages. Run the legacy-reference precondition before destructive DDL, drop `articles` without copying rows, and leave old migrations unchanged.
- [ ] **Step 4: Update `db/schema.sql` and implement section/material repositories.** Preserve transaction locking and update semantics from `db/articles.mjs`; ensure section moves validate destination ownership and published content constraints.
- [ ] **Step 5: Run targeted database tests.** Expected: all new section/material constraints and repository cases pass, including equal slugs in different sections.

### Task 2: Section and material HTTP APIs

**Files:**
- Create: `server/api/materialSections.mjs`, `server/api/materials.mjs`
- Test: `server/api/materialSections.test.mjs`, `server/api/materials.test.mjs`
- Modify: `server.mjs`
- Delete: `server/api/articles.mjs`, `server/api/articles.test.mjs`, `server/api/articles.concurrent.test.mjs`

**Interfaces:**
- `GET/POST /api/site/material-sections`; `PATCH/DELETE /api/site/material-sections/:id`.
- `GET/POST /api/site/materials`; `GET/PATCH/DELETE /api/site/materials/:id`.
- Section fields: `{ name, slug, sortOrder }`; material fields: `{ sectionId, slug, title, summary, content, coverMediaId, status }`.

- [ ] **Step 1: Add API tests** for section/material validation, site-scoped CRUD, foreign-site section rejection, cross-section move, duplicate slug conflict only within a section, and rejecting deletion while a section has materials or any Pages reference.
- [ ] **Step 2: Run the targeted API tests** and confirm the new imports/routes/handlers are missing or the expected requests fail.
- [ ] **Step 3: Implement section and material handlers** using `getCurrentSite`, UUID/content/status validation, transactions for material updates, and repository constraints. Return 409 for section-local slug conflicts or in-use sections; return clear validation errors for bad sections and media.
- [ ] **Step 4: Replace `server.mjs` article imports/routes** with section/material routes and remove the old article API routes.
- [ ] **Step 5: Run targeted API tests** and confirm all responses preserve site ownership and CRUD behavior.

### Task 3: Materials and sections administration UI

**Files:**
- Create: `admin/pages/SiteMaterialsPage.jsx`, `admin/pages/SiteMaterialEditorPage.jsx`
- Test: focused helper tests for section/material filtering and form validation, where behavior is extracted as pure functions.
- Modify: `admin/components/SiteSettingsLayout.jsx`, `server.mjs`
- Delete: `admin/pages/SiteArticlesPage.jsx`, `admin/pages/SiteArticlesPage.module.css`, `admin/pages/SiteArticleEditorPage.jsx`, `admin/pages/SiteArticleEditorPage.module.css`

**Interfaces:**
- Admin routes: `/admin/site/materials`, `/admin/site/materials/new`, `/admin/site/materials/:id`.
- Materials screen lists sections and the selected section's materials; section forms edit `name`, internal `slug`, and `sortOrder`.
- Material editor saves `sectionId` with the current Lexical content, cover, status, slug, title, and summary.

- [ ] **Step 1: Add pure tests** for selecting a section, status filtering, and preserving section/material form values across editing.
- [ ] **Step 2: Run those tests** and verify expected helpers are not implemented yet.
- [ ] **Step 3: Replace article navigation with “Материалы”** and implement section listing, create/edit/delete controls, selected-section material list, and clear in-use deletion errors using existing admin UI components/styles.
- [ ] **Step 4: Replace the article editor** with a material editor that loads/saves the selected section and preserves existing Lexical, cover, draft/publish and delete behaviors.
- [ ] **Step 5: Run targeted admin helper/SSR tests** and build the admin application through the later profile build.

### Task 4: Pages section selection and detail inheritance

**Files:**
- Test: `server/api/postPage.test.mjs`, `server/api/patchPage.test.mjs`, `admin/pages/pageSection.test.mjs`
- Modify: `shared/pageDataSources.mjs`, `server/api/postPage.mjs`, `server/api/patchPage.mjs`, `server/api/getPage.mjs`, `server/api/postDetailTemplate.mjs`, `admin/pages/PagesPage.jsx`, `admin/components/PageDetailsForm.jsx`, `admin/components/PageDetailsDialog.jsx`, `admin/components/PageList.jsx`

**Interfaces:**
- Pages API field `materialSectionId` is present for `dataSource='materials'`; it is null for standard, product/review list, and detail Pages.
- Creating/editing a material list sends `{ dataSource: 'materials', materialSectionId }`.

- [ ] **Step 1: Add API/UI helper tests** for required section, same-site validation, section change, uniqueness for active list Pages, and allowing a new list after the old one is in trash.
- [ ] **Step 2: Run those tests** and confirm the new source/section behaviors fail.
- [ ] **Step 3: Update the data-source definition and Pages API.** Return `materialSectionId`; validate the selected section against the site's ID; update `data_source` and `material_section_id` transactionally; map unique-index conflicts to a clear 409; leave detail Pages' section field null.
- [ ] **Step 4: Initialize detail content** with `@kroy/material` when the parent list source is materials; retain existing URL parameter and route-conflict logic.
- [ ] **Step 5: Update Pages create/edit forms** to select the section for material sources while keeping the user-entered path, and expose clear empty-section/duplicate-list errors.
- [ ] **Step 6: Run targeted Pages API and UI tests.** Confirm detail Pages inherit section via the parent, rather than storing a duplicate value.

### Task 5: Material parts, widgets, and ordinary-page section picker

**Files:**
- Create: `site/parts/material-list/package.json`, `site/parts/material-list/prepareMaterialList.mjs`, `site/parts/material/package.json`, `site/parts/material/prepareMaterial.mjs`, `site/widgets/material-cards/package.json`, `site/widgets/material-cards/MaterialCards.jsx`, `site/widgets/material-cards/materialCards.module.css`, `site/widgets/material-content/package.json`, `site/widgets/material-content/MaterialContent.jsx`
- Test: `site/parts/materialList.test.mjs`, `site/runtime/materialPage.test.mjs`, `build/registry/parsePartDoc.test.mjs`
- Modify: `shared/partModel.js`, `build/registry/parsePartDoc.mjs`, `admin/editor/Field.jsx`, `admin/editor/Editor.jsx`, `admin/editor/PartEditor.jsx`, `admin/editor/EditorWorkspace.jsx`, `site/runtime/Page.jsx`
- Delete: `site/parts/article-list/`, `site/parts/article/`, `site/widgets/article-cards/`, `site/widgets/article-content/`, `site/runtime/articleDisplay.*`, `site/runtime/articleListData.mjs`

**Interfaces:**
- `@kroy/material-list` has contract `materials-list`, default widget `@kroy/material-cards`, and optional `sectionId` for ordinary Pages.
- `@kroy/material` has contract `material`, default widget `@kroy/material-content` and renders the current `record`.
- On a material list Page, `Page` supplies `materialSectionId` and the part uses it over `props.sectionId`; on an ordinary Page, the picker supplies `props.sectionId`.
- A normal-page list uses the active Pages list's detail template for its selected section, or no links if no list exists.

- [ ] **Step 1: Add tests** for published-only preparation, section filtering, dynamic-page section precedence, explicit section selection on ordinary pages, and no-template unlinked cards.
- [ ] **Step 2: Run tests** and confirm the material contracts/data propagation are missing.
- [ ] **Step 3: Add a `material-section` metadata field type** following the existing `catalog-category` pattern; pass the current site's section options to editor fields and validate the metadata type in `shared/partModel.js`.
- [ ] **Step 4: Implement material parts/widgets** by retaining current markup/styles and Lexical display behavior while consuming section-scoped inputs.
- [ ] **Step 5: Update `Page`/editor data propagation** and delete old article part/widget/runtime files.
- [ ] **Step 6: Run focused part/SSR/metadata tests and `bun run parts:generate`** to verify all new registrations and contracts.

### Task 6: Preview, static generation, and publication

**Files:**
- Test: `admin/editor/materialPreview.test.mjs`, `server/api/getSitePreview.test.mjs`, `build/site/materialPages.test.mjs`, `build/site/buildSite.test.mjs`, `build/publication/publishPreparedSite.test.mjs`
- Modify: `admin/editor/articlePreview.mjs`, `admin/editor/Editor.jsx`, `server/api/getSitePreview.mjs`, `build/site/buildSite.mjs`, `build/site/createArticlePages.mjs`, `build/site/sitePageData.mjs`, `site/runtime/SiteApp.jsx`, `site/runtime/SiteRoot.jsx`, `build/publication/`
- Delete/rename: article-specific preview and page-generation helpers/tests.

**Interfaces:**
- `createMaterialPages(detailTemplates, materialsBySection)` expands a template only with published materials belonging to its parent's section.
- Preview and public page data carry only the chosen section's published material list and detail template.

- [ ] **Step 1: Add tests** for two independent section lists, section-specific detail generation, same slugs in different sections, cross-template resolved-path collision, ordinary-page list links, preview section filtering, and no draft/private content in publication output.
- [ ] **Step 2: Run targeted tests** and confirm current global article selection fails these assertions.
- [ ] **Step 3: Update preview API and editor preview** to use `materialSectionId` and fetch/render only that section; detail preview selects a published material in the parent section.
- [ ] **Step 4: Replace global article query/attachment in SSG** with per-section material data, generate detail Pages by parent-section membership, copy covers to material assets, and pass the resulting page/material payload to SSR/client registry.
- [ ] **Step 5: Preserve and test route conflict checks** across ordinary Pages, redirects, deleted Pages and all resolved material detail paths; allow duplicate slugs in separate sections where resolved paths differ.
- [ ] **Step 6: Update publication helpers** to consume the new prepared site output without changing release/rollback behavior.
- [ ] **Step 7: Run targeted preview, SSG and publication tests.** Expected: every Page/list/template contains only its selected section's published records.

### Task 7: Remove stale article references, update documentation, and verify

**Files:**
- Modify: `docs/requirements.md`, `docs/architecture.md`, `docs/arch-rules.md`, `docs/PARTS.md`, `docs/ROUTING.md`, all existing article-related tests not replaced above.
- Search: `rg -n '\barticles\b|Article|article'` across active source, tests, schema and docs; retain normal HTML `<article>` elements and unrelated natural-language uses.

- [ ] **Step 1: Replace stale contracts and docs** with Materials terminology, section-scoped Page sources and current admin/API routes; record section-owned slugs do not define public URLs.
- [ ] **Step 2: Search active source/tests/docs** for old article table/API/part/widget references and remove only implementation references no longer used.
- [ ] **Step 3: Run targeted database/API/Pages/parts/preview/SSG/publication tests**, then the full available suite with `bun test`.
- [ ] **Step 4: Run `bun run vyaz:build`** and verify generated parts/widgets registry and administrative/client SSR build.
- [ ] **Step 5: Run `git diff --check` through `git-manager`; report any unavailable DB-dependent tests or build constraints. Do not deploy, commit or push.**
