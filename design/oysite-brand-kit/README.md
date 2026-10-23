# Oysite · Brand Kit

Approved concept: variation **3C.1 / compact #4**, 23 October 2026.

## Assets

- `logo/oysite-logo.svg` / `.png` — complete wordmark, transparent background.
- `logo/oysite-logo-on-dark.svg` / `.png` — complete wordmark for dark backgrounds.
- `mark/oysite-mark.svg` / `.png` — custom `oy` mark without `site`, transparent.
- `mark/oysite-mark-on-dark.svg` / `.png` — mark for dark backgrounds.
- `icons/favicon.svg` / `.ico` / `favicon-16x16.png` / `favicon-32x32.png` / `favicon-48x48.png` — browser icons.
- `icons/apple-touch-icon.png` — 180 × 180 px.
- `icons/android-chrome-192x192.png` / `android-chrome-512x512.png` — app icons.
- `preview.png` — overview of light, dark and app icon usage.

All SVGs contain vector shapes and **outlined lettering** (no font dependency).
All wordmark and mark PNGs have transparent backgrounds. App icons have a light
rounded-square background. The icon is based on the wordmark's `oy` mark.

## Admin UI palette

| Role | Value |
| --- | --- |
| Accent | `#0C817A` |
| Text | `#203330` |
| Canvas | `#F5F8F7` |
| Surface | `#FFFFFF` |
| Sidebar | `#E9F2F0` |
| Border | `#D9E7E4` |
| Muted text | `#7B8E88` |

## Minimal HTML integration

```html
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icons/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<img src="/logo/oysite-logo.svg" alt="Oysite">
```

The original Git repository and `@vyaz/core` package naming can remain `vyaz`.
