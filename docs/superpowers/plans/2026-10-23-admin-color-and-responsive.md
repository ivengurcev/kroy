# Admin Color and Responsive Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the Oysite admin color hierarchy and make the editor, page map, and trash layouts work without overlap or horizontal overflow from 320 to 1440 px.

**Architecture:** Keep the existing React component tree and business logic. Update the scoped admin tokens and presentation variants, then replace fixed viewport positioning with CSS Grid shells whose `main` element owns scrolling; adapt existing component grids at content-driven breakpoints.

**Tech Stack:** JavaScript, React 19, CSS Modules, Vyaz, existing Oysite admin components.

**Spec:** `docs/superpowers/specs/2026-10-23-admin-color-and-responsive-design.md`

## Global Constraints

- Use `#0C817A` as the only decorative accent through semantic admin tokens.
- Keep `success`, `warning`, and `error` colors only for functional status communication.
- Do not use blanket opacity for disabled controls; set readable background, border, and text colors through tokens.
- Keep the page-map navigation, logo, status, save action, and every enabled action accessible at all supported widths.
- Hide or shorten only controls that are already disabled and nonfunctional.
- Do not change business logic, APIs, PostgreSQL, Vyaz, publishing, the logo/SVG files, `SiteTheme.module.css`, public parts, or `parts/section/Main.jsx`.
- Add no dependencies, components, global styles, browser tests, E2E tests, or test infrastructure.
- Run only `git diff --check` and one `yarn vyaz:build` after implementation.

## Review Focus

- At 320 and 390 px, page-map navigation and save remain reachable and no admin screen creates horizontal document scrolling.
- A toolbar that wraps to another row increases the header naturally and never overlays the editor workspace.
- Disabled primary, outline, and secondary buttons remain readable while being visually distinct from enabled actions.
- At the single-column workspace breakpoint, both preview and inspector remain in normal flow and reachable through the one `main` scrollbar.
- Display and inline-edit modes in `PageList` retain identical row geometry within each breakpoint, including 320 px.

---

### Task 1: Unify admin action and status colors

**Files:**
- Modify: `styles/AdminTheme.module.css`
- Modify: `components/ui/Button.module.css`
- Modify: `components/ui/StatusIndicator.module.css`
- Modify: `components/admin/AdminHeader.jsx`

**Interfaces:**
- Preserves: `Button({ variant, className, children, ...props })` and all current variant names.
- Preserves: `StatusIndicator({ title, details, tone, className })` and its tone names.
- Produces: semantic disabled colors and consistent `primary`, `outline`, `secondary`, and functional status presentation.

- [ ] **Step 1: Add semantic disabled tokens**

In `.theme`, add disabled background, border, and text variables derived from the existing sidebar, border, and muted-text palette. Remove decorative green base variables that become unused; retain warning and error tokens and only the success tokens needed for status communication.

- [ ] **Step 2: Normalize Button variants**

Keep `primary` filled with `--color-primary`, add or complete `outline` as an accent border/text button on a neutral surface, and keep `secondary` neutral. Make the existing `success` variant compatible without its old green gradient or a second accent color. Place variant-independent `.button:disabled` rules after enabled variants so disabled background, border, text, and shadow win without using opacity.

- [ ] **Step 3: Calm successful status presentation**

Update only `StatusIndicator.module.css`: success uses regular or secondary text with a small, quiet icon treatment based on the primary-soft palette. Preserve visible warning, error, and progress tones and existing live-region markup.

- [ ] **Step 4: Apply the intended publish hierarchy**

Change the disabled «Опубликовать» button in `AdminHeader.jsx` from the decorative success variant to `outline`. Keep «Посмотреть сайт» secondary and keep all current `disabled` behavior unchanged.

### Task 2: Make the editor shell and controls responsive

**Files:**
- Modify: `components/admin/AdminHeader.jsx`
- Modify: `components/admin/AdminHeader.module.css`
- Modify: `components/admin/AdminShell.module.css`
- Modify: `editor/EditorToolbar.module.css`
- Modify: `editor/EditorWorkspace.module.css`
- Modify: `editor/EditorFooter.module.css`

**Interfaces:**
- Preserves: all component props, DOM actions, navigation, save logic, and editor state.
- Produces: a `100dvh` three-row editor shell with one scroll owner and content-driven header/toolbar/workspace layouts.

- [ ] **Step 1: Replace fixed editor positioning with Grid**

Set `AdminShell.module.css` root to `display: grid`, `height: 100dvh`, `grid-template-rows: auto minmax(0, 1fr) auto`, and `overflow: hidden`. Remove header/footer height variables and fixed/inset positioning. Keep header and footer in their natural grid rows; make `.scrollArea` the only `overflow: auto` area with `min-height: 0`, and retain existing responsive outer padding.

- [ ] **Step 2: Define flexible AdminHeader grid areas**

Add purpose-specific CSS Module classes to the existing settings and page-map controls in `AdminHeader.jsx`; do not change their elements, handlers, or disabled state. Assign grid areas to those controls, the logo, current-page panel, preview action, and publish action. Replace fixed column tracks and fixed bar heights with flexible `minmax()`/content tracks and natural height. At progressively narrower breakpoints, reduce gaps, hide disabled settings first, move current-page/action groups to an additional row, and compact labels where necessary.

- [ ] **Step 3: Keep page-map navigation at every width**

Use the existing editor/pages mode classes to ensure the page-map tile or link is never hidden. At narrow widths, reduce its padding/icon/secondary copy before removing space from enabled actions. Do not use a broad `.headerTile { display: none; }` rule and do not hide the page-map link through overflow clipping.

- [ ] **Step 4: Allow the editor toolbar to wrap**

Change `.secondaryBar` from a fixed-height single flex row to a natural-height grid or wrapping layout. Keep mode tabs in the first group and history/status/save in the second; move the second group to another row when required. Keep status and save visible. At the narrowest breakpoint, compact or hide only currently disabled history/non-active mode controls, using disabled state selectors so a future enabled control remains reachable.

- [ ] **Step 5: Switch the workspace to one column before compression**

Move the one-column breakpoint from the current phone-only width to the first medium width where the inspector and preview no longer fit comfortably. Add `min-width: 0` and `min-height: 0` to the relevant workspace/canvas containers without changing part preview geometry. Ensure preview and inspector remain in document flow under the single `main` scrollbar.

- [ ] **Step 6: Put the footer in the shell flow**

Remove fixed positioning and viewport offsets from `EditorFooter.module.css`. Keep the footer centered in the third grid row, preserve the segmented device control, and adjust only its outer padding/margins at the existing responsive widths.

### Task 3: Adapt page map and trash, then verify

**Files:**
- Modify: `components/admin/AdminPageShell.module.css`
- Modify: `pages/PagesPage.module.css`
- Modify: `components/admin/PageList.module.css`

**Interfaces:**
- Preserves: `AdminPageShell` props, `PagesPage`/`TrashPage` data ownership, all page operations, and `PageList` inline-edit behavior.
- Produces: a two-row page shell with central scrolling and responsive forms/rows using the existing markup.

- [ ] **Step 1: Convert AdminPageShell to natural-height Grid**

Set `.shell` to `display: grid`, `height: 100dvh`, `grid-template-rows: auto minmax(0, 1fr)`, and `overflow: hidden`. Remove header-height variables and fixed positioning. Keep `.content` as the sole scroll area with `min-height: 0`; let `.header` and `.sectionBar` derive height from their content.

- [ ] **Step 2: Wrap page-screen heading actions safely**

Allow `.sectionBar` and `.actions` to wrap before labels collide. Preserve all action links/buttons and their current semantics. At 390–320 px, use full available width or compact grouping so Trash/Create/Return remain reachable without page overflow.

- [ ] **Step 3: Adapt the create form before phone width**

Move `PagesPage.module.css` from three columns to a single-column form at the first width where two fields plus actions no longer fit, rather than waiting for overflow. Keep inputs at `min-width: 0`, action buttons reachable, and error space stable.

- [ ] **Step 4: Adapt PageList while preserving row geometry**

Move the mobile grid breakpoint earlier so path, title, and actions stack before the desktop action track overflows. Retain fixed and equal display/edit row heights within every breakpoint. At 390–320 px, keep action buttons inside the row, constrain text/inputs with `minmax(0, 1fr)`, and preserve all edit/delete/restore controls without horizontal scrolling.

- [ ] **Step 5: Review the required widths in CSS**

Inspect the resulting media-query cascade against 1440, 1280, 1024, 820, 768, 600, 390, and 320 px. Confirm from the declarations that page-map/save are never hidden, only disabled toolbar functions may disappear, and no fixed header/footer offsets remain. Do not launch a browser or add visual-test tooling.

- [ ] **Step 6: Run the required diff check once**

Run: `git diff --check`

Expected: exit code 0 and no output.

- [ ] **Step 7: Run the profile build once**

Run: `yarn vyaz:build`

Expected: parts generation and Vyaz public/SSR builds complete without errors.

- [ ] **Step 8: Report manual checks**

Ask the user to inspect the editor, page map, and trash at the eight requested widths; verify central-only scrolling, stationary header/footer, readable disabled states, toolbar wrapping, page-map/save access, single-column preview/inspector access, and stable inline-edit rows. Do not run browser or E2E checks.
