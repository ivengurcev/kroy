# Site Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide one scoped public-site token theme for published pages and editor previews.

**Architecture:** A neutral `SiteRoot` applies `SiteTheme.module.css` around public `Page` output. Admin controls remain outside this subtree.

**Tech Stack:** JavaScript, React 19, CSS Modules

**Spec:** `docs/superpowers/specs/2026-10-21-site-theme-design.md`

## Global Constraints

- Add only the specified tokens and base inherited styles.
- Do not change parts, APIs, database, Vyaz, publication, or editor operations.
- Verify only with `git diff --check` and `yarn vyaz:build`.

---

### Task 1: Theme and root

- [ ] Create `styles/SiteTheme.module.css` with the exact token values.
- [ ] Create neutral `layout/SiteRoot.jsx`.

### Task 2: Integration and documentation

- [ ] Wrap public `SiteApp` output in `SiteRoot`.
- [ ] Wrap only editor public content in the same `SiteRoot`.
- [ ] Document public/admin separation and token usage.

### Task 3: Verification

- [ ] Run `git diff --check`.
- [ ] Run `yarn vyaz:build` once.
