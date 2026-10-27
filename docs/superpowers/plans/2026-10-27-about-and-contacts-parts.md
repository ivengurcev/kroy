# About and Contacts Parts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public, editable `@kroy/about` and `@kroy/contacts` parts, including an SSR-safe Leaflet/OpenStreetMap map.

**Architecture:** A shared client-only `components/site/Map.jsx` owns the Leaflet instance and synchronizes its center, zoom and marker without affecting SSR. Each new part remains self-contained in `parts/<name>/`, uses JSDoc metadata for the existing editor and CSS Modules backed only by public `--site-*` tokens.

**Tech Stack:** JavaScript, React 19, CSS Modules, Leaflet 1.9.4, OpenStreetMap, Yarn 4 PnP.

**Spec:** `docs/superpowers/specs/2026-10-27-about-and-contacts-parts-design.md`

## Global Constraints

- Add only Leaflet as a dependency; use its current stable release `1.9.4`, not the 2.0 alpha.
- Load Leaflet dynamically on the client; map SSR must not access `window` or DOM APIs.
- Preserve OpenStreetMap attribution and avoid API keys, `STATIC_PATH`, and timer-based initialization.
- Use only `--site-*` tokens in new public CSS; do not change the editor, theme system, Hero, or Services.
- Do not add test files: repository `AGENTS.md` forbids them unless explicitly requested.
- Verify with `git diff --check` and one `yarn vyaz:build`; no browser or E2E checks.

## Review Focus

- Server rendering must output Contacts without importing Leaflet or accessing browser globals — covered by the profile build in Task 2.
- Changing latitude, longitude, zoom, or marker text must update the existing map and marker rather than leak another instance — manual check in Task 2.
- Removing Contacts must dispose its Leaflet map and tile listeners — manual check in Task 2.
- A malformed or absent phone must not create a misleading `tel:` link — implementation check in Task 4.
- Narrow layouts must preserve readable text and a bounded map in editor, preview and static output — manual check in Task 4.

---

### Task 1: Add Leaflet runtime dependency and shared map component

**Files:**
- Modify: `package.json`
- Modify: `yarn.lock`
- Create: `components/site/Map.jsx`
- Create: `components/site/Map.module.css`

**Interfaces:**
- Produces: `Map({ latitude, longitude, zoom, markerText, className })`, rendered as a map container with the mandatory OpenStreetMap attribution.
- Consumes: Leaflet’s `map`, `tileLayer`, `marker`, and `divIcon` APIs through a client-side dynamic import.

- [ ] **Step 1: Add `leaflet@1.9.4` to project dependencies through Yarn**

Run: `yarn add leaflet@1.9.4`

Expected: `package.json` and `yarn.lock` describe Leaflet as the only new dependency.

- [ ] **Step 2: Implement `Map` in `components/site/Map.jsx`**

Create its Leaflet instance only after a dynamic import in `useEffect`; create OSM tiles with attribution, a CSS `divIcon` marker and popup; update the existing map/marker through separate effects when props change; call `map.remove()` on cleanup. Import Leaflet’s package CSS once in this shared component.

- [ ] **Step 3: Add bounded map and marker styles in `components/site/Map.module.css`**

Use site tokens for the container boundary and the custom marker. Do not override global Leaflet styles or depend on asset paths.

- [ ] **Step 4: Inspect the diff**

Run: `git diff -- package.json yarn.lock components/site/Map.jsx components/site/Map.module.css`

Expected: no server-side Leaflet initialization, static timeout, or `STATIC_PATH` reference.

### Task 2: Add the About part

**Files:**
- Create: `parts/about/package.json`
- Create: `parts/about/About.jsx`
- Create: `parts/about/about.module.css`

**Interfaces:**
- Produces: `@kroy/about` through the existing manifest discovery convention.
- Consumes: a heading and newline-separated body text from page part props.

- [ ] **Step 1: Create the About manifest and component metadata**

Declare `@kroy/about`, `@kroy-title О себе`, and an appropriate content category. Add `@param`/`@kroy` metadata for the `title` input and multiline `text` field.

- [ ] **Step 2: Render semantic heading and paragraphs in `About({ title = '', text = '' })`**

Split newline-separated text into nonempty paragraphs without interpreting markup. Omit empty heading and body elements.

- [ ] **Step 3: Add responsive About styles**

Create a compact, editorial two-column composition that collapses to one column using the component’s own container query. Use public colors, fonts and spacing tokens only.

- [ ] **Step 4: Generate the part registry**

Run: `yarn parts:generate`

Expected: output names `@kroy/about`, `@kroy/hero`, and `@kroy/services`; metadata contains the new human-readable title and category.

### Task 3: Add the Contacts part

**Files:**
- Create: `parts/contacts/package.json`
- Create: `parts/contacts/Contacts.jsx`
- Create: `parts/contacts/contacts.module.css`

**Interfaces:**
- Consumes: `Map({ latitude, longitude, zoom, markerText, className })` from Task 1.
- Produces: `@kroy/contacts` through the existing manifest discovery convention.

- [ ] **Step 1: Create the Contacts manifest and full JSDoc metadata**

Declare `@kroy/contacts`, `@kroy-title Контакты`, and an appropriate content category. Describe editable `title`, `address`, `hours`, `phone`, `latitude`, `longitude`, `zoom`, and `markerText`; select existing widget settings that render phone as `tel` and map coordinates/zoom as numeric controls.

- [ ] **Step 2: Render `Contacts` with semantic contact data and map**

Show each nonempty contact item. Normalize only the telephone target by removing display separators; render a `tel:` link only when a number remains. Pass valid numeric map props to the shared `Map` component and use neutral defaults for missing values without embedding veterinarian-specific data.

- [ ] **Step 3: Add responsive Contacts styles**

Lay out contact data and map side by side on wide containers, then stack them on narrow containers. Make map height and overflow safe, preserve the site token system, and style telephone links/focus states accessibly.

- [ ] **Step 4: Generate the part registry**

Run: `yarn parts:generate`

Expected: output includes `@kroy/contacts` and its title, category, and editable field schema.

### Task 4: Integrate and verify the public build

**Files:**
- Modify: `demo/page.json` only if a minimal non-specific example is needed to expose the new parts in the local demonstration page.

**Interfaces:**
- Consumes: registry entries from Tasks 2–3 and the shared map interface from Task 1.

- [ ] **Step 1: Inspect existing demo data and only add neutral examples if needed**

Keep the data format `{ part, props }`; do not change database pages or existing parts.

- [ ] **Step 2: Run the mandated technical checks**

Run: `git diff --check`

Expected: exit code 0 with no whitespace errors.

Run: `yarn vyaz:build`

Expected: exit code 0 and the generated part registry includes all four public parts.

- [ ] **Step 3: Record manual checks for the user**

List the editor, preview and published-site checks: paragraph splitting; editable Contacts fields; map load/update/disposal; phone link; mobile and desktop composition.
