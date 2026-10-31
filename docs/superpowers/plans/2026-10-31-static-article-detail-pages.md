# Static Article Detail Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate one complete static HTML page per published article for each active articles detail template, with matching SSR and hydration.

**Architecture:** During the existing repeatable-read build, expand active detail templates whose parent list uses `data_source = 'articles'` into concrete page entries. Pass configuration, route context, and article content separately: `props`/widget `options`, `context.params`, and `record`. Keep only ordinary/list pages in the shared client registry; embed the current detail page payload in that HTML response for hydration so `app.js` does not contain every article. New article detail templates start with an editable article part and compatible widget.

**Tech Stack:** React 19, Node.js, PostgreSQL, esbuild, existing Lexical JSON, CSS Modules, Vyaz static publishing pipeline.

**Spec:** User request from 2026-10-31; no separate design document is required.

## Global Constraints

- Support only `articles`; do not add a generic source registry or fetching abstraction.
- Use one final route parameter with its configured name.
- Do not change route editing or add dynamic SSR through Vyaz.
- Preserve standard/list page output, existing part/widget contracts, and CSS Modules behavior.
- Publish only articles with `status = 'published'`.
- Keep article record data separate from part and widget settings.
- Do not implement article 301 redirects or add a migration for `redirects.to_path` in this phase.

## Review Focus

- A non-`slug` parameter generates the correct route and matching `context.params` key; cover `/cases/:caseId`.
- Zero published articles still build and drafts produce no files; cover both cases.
- Concrete article routes colliding with a static page, redirect, deleted path, or another generated path fail before output replacement; test each collision class.
- The initial part/widget content can be edited, replaced, or deleted through the existing page editor; test that `content` can be saved as an empty array.
- Lexical text, marks, headings, lists, and safe links appear in SSR; the current page payload hydrates that same tree without including other articles in `app.js`.

---

### Task 1: Expand article templates into concrete page entries

**Files:**
- Create: `scripts/createArticlePages.mjs`
- Test: `scripts/createArticlePages.test.mjs`

**Interfaces:**
- `createArticlePages(templates, articles)` returns `{ path, title, content, context: { params }, record }` entries.
- A template contains `{ path, route_param, content }`; an article contains published public fields and optional `coverUrl`.
- Replace only the template's final `/:route_param` with the validated article slug. `record` is `{ slug, title, summary, content, coverUrl }`.

- [ ] Test custom parameter names, root-level templates, multiple templates, empty article input, invalid route patterns/slugs, and separation between template `content` and article `record.content`.
- [ ] Implement only this article-specific route expansion; do not add a source adapter interface.

### Task 2: Render article records through compatible parts and widgets

**Files:**
- Modify: `layout/Page.jsx`
- Modify: `layout/SiteApp.jsx`
- Create: `layout/LexicalContent.jsx`
- Create: `layout/LexicalContent.module.css`
- Test: `layout/LexicalContent.test.mjs` or the existing React SSR test location
- Create: `parts/article/Article.jsx`
- Create: `parts/article/package.json`
- Create: `widgets/article-content/ArticleContent.jsx`
- Create: `widgets/article-content/package.json`
- Create: widget CSS Module only if the widget needs separate presentation

**Interfaces:**
- `Page` accepts optional `context = { params: {} }` and `record = null`.
- Parts keep their current prepared settings props and receive separate `context` and `record` props.
- Widgets keep `{ data, options }` and receive separate `context` and `record` props.
- `@kroy/article` and `@kroy/article-content` declare the same `article` contract and JSDoc name/category for discovery.
- `LexicalContent({ value })` supports nodes emitted by `ArticleEditor`: paragraphs, H2/H3, lists/list items, links, and bold/italic/underline text. Unknown nodes preserve readable child text; links allow only safe URL schemes.

- [ ] Add SSR tests for title, cover, Lexical text, marks, headings, lists, and safe links.
- [ ] Implement recursive React rendering without raw HTML injection.
- [ ] Add the catalogued article part and widget; both read article fields only from `record`.
- [ ] Confirm existing parts/widgets still work with absent `record` and default context.

### Task 3: Create editable default content for article templates

**Files:**
- Modify: `api/postDetailTemplate.mjs`
- Test: `api/pageDetails.concurrent.test.mjs` or a focused detail-template integration test

**Interfaces:**
- When the selected list uses `data_source = 'articles'`, initialize template `content` with one block: `part: '@kroy/article'`, `props: {}`, and `view: { name: '@kroy/article-content', props: {} }`.
- For other list sources, retain the existing empty content behavior.
- The initial block remains ordinary saved page content: the existing editor can edit its part settings, switch/remove its widget, or delete the block and save `content: []`.

- [ ] Test that an articles list creates the part/widget block with the expected empty settings.
- [ ] Test that the existing page content API accepts replacing or removing this block, including an empty content array.

### Task 4: Build only the current article payload into each HTML response

**Files:**
- Modify: `scripts/buildSite.mjs`
- Modify: `scripts/renderSite.jsx`
- Modify: `scripts/hydrateSite.jsx`
- Modify: `scripts/generateSiteParts.mjs`
- Modify: `layout/SiteApp.jsx`
- Test: `scripts/buildSite.test.mjs` or focused tests beside `createArticlePages`

**Interfaces:**
- In the current repeatable-read build transaction, select active detail templates joined to active parent lists with `data_source = 'articles'`, plus articles with `status = 'published'` only.
- Join cover media by both media ID and site ID, copy referenced files to `assets/articles/`, and set deterministic release URLs as `record.coverUrl`.
- Generate HTML from `ordinary/list pages + article page entries`; use all rendered entries for part/widget discovery and SSR.
- Keep article page records out of `dist/kroy/site-pages.mjs`. Put the current detail entry in an `application/json` script in its HTML, escaping `<` as `\u003c`; `hydrateSite.jsx` reads that payload and passes it to `SiteApp` as `initialPage`.
- Keep ordinary/list pages in the shared registry. Navigating to an article page absent from that registry follows the existing full-page navigation path, then hydrates from its own HTML payload.

- [ ] Test drafts, zero matches, cover present/missing, and collision with static pages, redirects, deleted paths, or another generated article path; detect collisions before replacing output.
- [ ] Test that a detail page HTML contains its Lexical article text and payload, while its `app.js` has no article-specific sentinel text and its payload excludes other articles.
- [ ] Compare `app.js` byte and gzip sizes with the expected shared static registry; report that article data scales with per-page HTML rather than all article JSON being embedded in the client bundle.
- [ ] Confirm SSR and hydration consume the same `initialPage` values and the existing CSS Module validation still passes.
- [ ] Confirm sites without article templates retain their current output.

### Task 5: Verify and document old URL behavior for this phase

**Files:**
- No new redirect implementation files.

- [ ] Verify article detail pages use the configured list/template path and never a fixed `/articles` path.
- [ ] Document that after a published article slug or parent list path changes, the old concrete URL returns the current static site's 404; no article 301 is created in this phase.
- [ ] Keep current page-level redirects for the list page itself unchanged.

### Task 6: Run focused verification

- [ ] Run route expansion, Lexical SSR, template initialization/editability, and static routing tests.
- [ ] Build an isolated site fixture with a published article, draft, custom route parameter, and cover; assert one generated detail HTML per published article/template pair.
- [ ] Confirm article text is present before hydration and that CSS Module checks pass for SSR and client builds.
- [ ] Run the existing app build and `git diff --check`; do not deploy or commit as part of implementation.

## Client Bundle and Later URL Policy

If all article records are inserted into `site-pages.mjs`, the client `app.js` includes approximately the serialized size of every published Lexical document and its metadata (before compression), so bundle growth is proportional to the site's total article content. The recommended per-page `initialPage` JSON avoids that cost in the shared bundle and transfers only the current article's data. The current article payload is duplicated in its HTML alongside the SSR-rendered text; this is a bounded per-page cost and avoids a second data request.

301 handling is a separate later phase. It may add a nullable concrete `redirects.to_path` and transactional updates on article slug and parent-list path changes. Do not include that migration, API work, or routing behavior in this implementation.
