# Site Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a protected `/admin/site` page that edits the current site's theme and token overrides without affecting publication or other sites.

**Architecture:** The page loads the theme registry and current-site settings through hostname-scoped admin APIs. It keeps edits local until one PATCH saves `theme_id`, `theme_mode`, and nested light/dark overrides; the header's existing “Сайт” action becomes a normal link.

**Tech Stack:** React 19, CSS Modules, Hono/Vyaz API handlers, PostgreSQL, existing theme registry and admin controls.

**Spec:** User request for `/admin/site` site appearance settings.

## Global Constraints

- Only implement the “Оформление” section.
- Do not change publication, public rendering, SEO, domains, logos, or database schema.
- Never accept a site id from the client; resolve the site from the current Host and authenticated access.
- Preserve nested light/dark overrides when changing theme or mode.

## Review Focus

- Unknown Host or missing site returns an error and cannot be edited.
- Theme and mode changes preserve both override palettes.
- Editing one palette leaves the other unchanged while the opposite column is disabled.
- Resetting one token or all overrides is local until Save.
- Leaving with unsaved edits warns without losing the draft.

### Task 1: Host-scoped theme API and route

**Files:** Modify `server.mjs`; create API handlers as needed.

- Add protected GET/PATCH endpoints returning the registry and current site's theme settings.
- Resolve `site_id` only by `getHostname(c)` joined to `domains`.
- PATCH validates theme id/mode/overrides using existing `setSiteTheme`, then returns saved settings.
- Register `/admin/site` as a private page route.

### Task 2: Site settings page

**Files:** Create `pages/SitePage.jsx`, `pages/SitePage.module.css`.

- Load themes/settings, maintain local draft, and warn on unload when dirty.
- Render a compact theme select with token-based thumbnails, mode controls, grouped light/dark token editors, per-token reset, reset-all, and Save.
- Disable the non-selected palette for light/dark modes; keep system mode both editable.

### Task 3: Header navigation and verification

**Files:** Modify `components/admin/AdminHeader.jsx` only as needed.

- Change “Сайт” from disabled button to `/admin/site` link while retaining title/aria-label and logout behavior.
- Run `git diff --check` and one available profile build.

