# Kroy Five Theme Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Расширить систему тем Kroy с трёх до пяти редактируемых основных цветов и точечно использовать новые токены в публичных запчастях.

**Architecture:** Реестр сохранит отдельные базовые токены палитр и продолжит вычислять производные токены. Старые темы и сохранённые настройки получат fallback в реестре и CSS; редактор будет получать новые цвета через уже существующий `metadata`/`TokenTable` поток.

**Tech Stack:** JavaScript, React, CSS Modules, JSON-темы, Yarn 4 PnP.

**Spec:** Утверждённый дизайн из диалога 2026-10-30.

## Global Constraints

- Сохранить существующие `--site-color-bg`, `--site-color-text`, `--site-color-accent`.
- Добавить `--site-color-accent-secondary` и `--site-color-section-bg` с независимыми light/dark значениями.
- Сохранить вычисление производных токенов и не увеличивать число обязательных пользовательских настроек.
- Не добавлять зависимости, архитектурные уровни, API или автоматическую публикацию.
- Сохранить JavaScript, Yarn PnP и совместимость со старыми site overrides.

## Review Focus

- Старая тема без новых ключей → реестр возвращает совместимые fallback-значения.
- Старый override без новых ключей → новые значения берутся из темы, старые override не меняются.
- Редактирование light/dark → каждая из пяти базовых переменных сохраняется отдельно.
- Производные цвета → `surface`, `surface-soft`, `border`, `text-secondary`, `accent-hover` продолжают вычисляться после расширения.
- Запчасти без новых токенов → внешний вид сохраняется через fallback, а новые акценты не окрашивают все элементы подряд.

### Task 1: Extend the theme token model

**Files:**
- Modify: `themes/themeRegistry.mjs`
- Modify: `themes/tokenMetadata.mjs`
- Modify: `styles/SiteTheme.module.css`

- [ ] Add the two tokens to `PALETTE_TOKENS` and provide registry fallbacks for themes whose palette lacks them.
- [ ] Add Russian metadata labels for both tokens; keep derived tokens computed by `computedTokens()`.
- [ ] Add CSS fallback declarations for the two variables.
- [ ] Verify with a Node assertion that every loaded theme exposes five palette tokens and that fallback normalization works.

### Task 2: Update built-in themes

**Files:**
- Modify: `themes/*.json` (all built-in theme JSON files)

- [ ] Add meaningful light/dark values for `--site-color-accent-secondary` and `--site-color-section-bg` to every built-in theme.
- [ ] Keep calm themes restrained and bright themes expressive while preserving each existing theme’s identity.
- [ ] Verify JSON parsing and equal light/dark token sets through the existing theme registry loader.

### Task 3: Expose and use the new colors

**Files:**
- Modify: `pages/SitePage.jsx`
- Modify: `pages/SitePage.module.css`
- Modify: `parts/hero/hero.module.css`
- Modify: `parts/services/services.module.css`
- Modify: `parts/reviews/reviews.module.css`
- Modify: `parts/category-products/category-products.module.css`
- Modify: `parts/links/links.module.css`

- [ ] Update theme thumbnails to show primary accent, secondary accent and section background in both panes.
- [ ] Keep the existing token table flow so both palettes expose the five base colors with metadata labels.
- [ ] Add restrained fallback-backed uses of secondary accent/section background in the specified parts only.
- [ ] Preserve existing hierarchy, responsive behavior, reduced motion and all unrelated component behavior.

### Task 4: Verify integration

- [ ] Run the registry assertion and JSON/theme loading check.
- [ ] Run one profile build command available in the repository.
- [ ] Run `git diff --check` and inspect that unrelated local changes were not modified.

