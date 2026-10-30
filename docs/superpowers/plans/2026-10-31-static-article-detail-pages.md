# Static Article Detail Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a static HTML page for every published article at each active articles detail-template route, with complete SSR content and matching hydration.

**Architecture:** During the existing repeatable-read site build, expand active detail templates whose parent list uses `data_source = 'articles'` into concrete page entries. Keep template settings, route params, and the article record separate: block settings remain `props`/`data` and widget `options`, `context.params` carries the configured route parameter, and `record` carries the public article fields. Feed the same expanded page registry to SSR and hydration. Preserve changed article and list URLs with concrete 301 targets.

**Tech Stack:** React 19, Node.js, PostgreSQL, esbuild, existing Lexical JSON, CSS Modules, Vyaz static publishing pipeline.

**Spec:** User request; page-type foundation in `docs/superpowers/specs/2026-10-31-public-article-pages-design.md`.

## Global Constraints

- Support only `articles`; do not add a generic source registry or fetching abstraction.
- Use exactly one final route parameter, with its existing configured name.
- Do not change route editing or add dynamic SSR through Vyaz.
- Preserve standard/list page output, existing part and widget contracts, and CSS Modules behavior.
- Include only published articles; never render drafts into generated HTML or the client registry.
- Keep article data separate from block and widget configuration.

## Review Focus

- A template with a non-`slug` parameter must generate the correct concrete URL and `context.params` key. Test a template such as `/cases/:caseId`.
- A site with zero published articles must still build; drafts must produce no HTML. Test both cases.
- A generated route colliding with a concrete page or redirect must fail the build before replacing site output. Test collision detection.
- Existing standard redirects and article slug/list-path redirects must resolve to concrete paths. Test legacy `to_path IS NULL` redirects and explicit targets.
- Lexical text, marks, headings, lists, and safe links must appear in SSR and hydrate from the same record. Test rendered text/markup and SSR/client registry equality.

---

### Task 1: Expand article templates into concrete page records

**Files:**
- Create: `scripts/createArticlePages.mjs`
- Test: `scripts/createArticlePages.test.mjs`
- Modify: `api/pageFields.mjs` only if a small shared route-expansion validator is needed

**Interfaces:**
- `createArticlePages(templates, articles)` returns page entries shaped as `{ path, title, content, context: { params }, record }`.
- `templates` contain `{ path, route_param, content }`; `articles` contain published public article fields and optional `coverUrl`.
- Concrete paths are made by replacing the template's final `/:route_param` with the validated article slug. `record` is `{ slug, title, summary, content, coverUrl }`.

- [ ] Test custom parameter names, root-level templates, one page per template/article pair, and `context.params` using the configured key.
- [ ] Test empty article input and rejection of invalid route patterns/slugs.
- [ ] Implement only the articles-specific expansion; do not create a source adapter interface.
- [ ] Test that returned template block content and record content remain separate.

### Task 2: Pass route context and article record through the renderer

**Files:**
- Modify: `layout/Page.jsx`
- Modify: `layout/SiteApp.jsx`
- Create: `layout/LexicalContent.jsx`
- Create: `layout/LexicalContent.module.css`
- Create: `layout/LexicalContent.test.mjs` or the nearest existing React SSR test location
- Create: `parts/article/Article.jsx`
- Create: `parts/article/package.json`
- Create: `widgets/article-content/ArticleContent.jsx`
- Create: `widgets/article-content/package.json`
- Create: widget CSS Module only if its presentation needs styles
- Modify: `scripts/generateSiteParts.mjs` only if it needs to validate detail-template dependencies independently of generated pages

**Interfaces:**
- `Page` accepts optional `context = { params: {} }` and `record = null`.
- Legacy parts receive their existing prepared props plus separate `context` and `record` props.
- Widgets retain `{ data, options }` and additionally receive separate `context` and `record` props.
- `@kroy/article` and `@kroy/article-content` both declare contract `article`; JSDoc supplies their display name and category for discovery.
- `LexicalContent({ value })` renders the node types emitted by `ArticleEditor`: paragraphs, H2/H3, lists/list items, links, and bold/italic/underline text.

- [ ] Add SSR tests for article title, cover, Lexical text, marks, headings, lists, and safe link URLs.
- [ ] Implement recursive React rendering without raw HTML injection; unknown nodes preserve child text.
- [ ] Add the catalogued `@kroy/article` part and compatible `@kroy/article-content` widget, both reading only `record` for article fields.
- [ ] Verify standard pages still call parts/widgets without requiring article data and retain their current rendered output.

### Task 3: Load published articles and produce matching SSR/hydration output

**Files:**
- Modify: `scripts/buildSite.mjs`
- Modify: `scripts/renderSite.jsx`
- Modify: `scripts/hydrateSite.jsx` only if registry props need explicit wiring
- Modify: `scripts/generateSiteParts.mjs`
- Test: `scripts/buildSite.test.mjs` or focused tests beside the extracted page-expansion helper

**Interfaces:**
- In the current build transaction, select active article detail templates joined to active parent lists with `data_source = 'articles'` and published articles only.
- Join covers to same-site media metadata; copy referenced cover files to `assets/articles/` and set deterministic release URLs in `record.coverUrl`.
- Build `renderPages = standard/list pages + expanded article pages`; use it for the generated page registry, part/widget discovery, and SSR page list.
- Each page registry entry contains the same `content`, `context`, and `record` values used for its SSR render.

- [ ] Test draft exclusion, published article inclusion, templates with no matching articles, and missing cover behavior.
- [ ] Test concrete output paths against standard pages, redirects, deleted paths, and other generated article paths before the renderer clears/replaces site output.
- [ ] Feed `renderPages` through the existing SSR path and make `SiteApp` render each article page with its own title/context/record.
- [ ] Feed the same `site-pages.mjs` registry to `hydrateSite.jsx`; add an assertion that generated SSR article text and registry record content match.
- [ ] Preserve the existing behavior when a site has no article detail templates.

### Task 4: Keep old article URLs working after slug or list-path changes

**Files:**
- Create: `db/migrations/202610310002_add_redirect_to_path.sql`
- Modify: `db/schema.sql`
- Modify: `api/articles.mjs`
- Modify: `api/patchPage.mjs`
- Modify: `scripts/buildSite.mjs`
- Modify: `scripts/generateSiteRouting.mjs`
- Test: `api/articles.concurrent.test.mjs` or a focused article redirect integration test
- Test: `scripts/generateSiteRouting.test.mjs`

**Policy:**
- Recommend 301 redirects for old URLs after a published article changes slug or its parent list path changes.
- Add nullable `redirects.to_path`; old page redirects keep `NULL` and continue resolving through `page_id`. Article route redirects store a concrete destination such as `/journal/new-slug` and keep `page_id` linked to the detail template for lifecycle/soft-delete behavior.
- On a published article slug change, record each active articles-template old URL to its new concrete URL in the same transaction as the article update; retarget prior aliases for that same template/article path.
- On a list path change, record redirects for currently published articles from the old base path to the new base path in the existing page-update transaction. Changing only `route_param` changes no concrete URL and needs no redirect.

- [ ] Test slug rename redirects, parent list path rename redirects, custom route parameter names, redirect destination conflicts, and unchanged legacy page redirects.
- [ ] Extend build routing to use `to_path` when present and fall back to the current linked page path for legacy rows.
- [ ] Validate all generated `from`/`to` paths as concrete public paths and reject redirect loops/collisions before publishing the release.
- [ ] Verify soft-deleting the detail template continues to make its redirects follow the existing gone/410 behavior.

### Task 5: Run focused verification

**Files:**
- No additional implementation files.

- [ ] Run the focused page expansion, Lexical SSR, API redirect, and routing tests.
- [ ] Run the existing app build and a site build against an isolated fixture containing a published article, a draft, a custom route parameter, and a cover image.
- [ ] Check generated article HTML contains the full Lexical text before hydration and that CSS Module sets match for SSR and client bundles.
- [ ] Run `git diff --check`; do not deploy or commit as part of implementation.

## URL Policy Decision

The plan recommends preserving old published URLs with 301 redirects. This requires one nullable redirect destination column because the current redirects table resolves every target through `pages.path`, while an article target is a concrete URL generated from a detail template. If a slug change is made while an article is a draft, it has no public old URL to redirect. Unpublishing or deleting an article removes its generated HTML; its old URL will return the site's existing 404 behavior unless a separate 410 policy is requested.
