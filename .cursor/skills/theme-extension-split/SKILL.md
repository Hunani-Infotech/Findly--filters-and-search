---
name: theme-extension-split
description: >-
  Keeps Shopify Theme App Extension schema JS/CSS under the 100 KB
  AssetSizeAppBlock cap by splitting into companion files loaded via Liquid
  asset_url. Never deletes existing widget functionality to shrink files. Use
  when editing extensions/smart-filter, minifying theme extension JS, hitting
  the 100 KB Shopify limit, adding storefront widget features, or when
  theme:minify fails the size check.
---

# Theme extension split (100 KB cap)

Shopify caps only the file named in the app-block schema:

- `"javascript": "smart-filter.min.js"` → **100000 B** (`AssetSizeAppBlockJavaScript`)
- `"stylesheet": "smart-filter.css"` → **100000 B** (`AssetSizeAppBlockCSS`)

Files loaded from Liquid with `asset_url` are **not** that cap. Minify still runs; it does not delete features.

## Hard rule

**Never remove existing widget behavior to hit 100 KB.** Extract it (or new work) into a companion file.

Do not hand-edit `*.min.js`. Those are generated.

## After any theme-extension change

1. Keep source of truth in `extensions/smart-filter/assets/*.js` (not `.min.js`).
2. Run `npm run theme:minify`.
3. If `smart-filter.min.js` is ≥ 100000 B, split — do not strip code.
4. Confirm companion scripts still load from every relevant Liquid block.

## Split workflow

Copy this checklist:

```
- [ ] Existing functions left in place (no deletes “to save bytes”)
- [ ] New/overflow code in extensions/smart-filter/assets/smart-filter-<feature>.js
- [ ] Liquid loads {{ 'smart-filter-<feature>.min.js' | asset_url }}
- [ ] Minify job added (no limitBytes on companions)
- [ ] npm run theme:minify succeeds; schema JS < 100000 B
```

### 1. Create the companion

Path: `extensions/smart-filter/assets/smart-filter-<feature>.js`

Match `smart-filter-grid.js`: IIFE, `"use strict"`, patch `Widget.prototype` as soon as `window.__FINDLY_FILTER_WIDGET` is set (getter/setter so it works if the companion loads first).

### 2. Load from Liquid

Add **before** the widget root, in **every** block that uses the schema JS:

- `extensions/smart-filter/blocks/collection-filters.liquid`
- `extensions/smart-filter/blocks/collection-filters-embed.liquid`

```liquid
<script src="{{ 'smart-filter-<feature>.min.js' | asset_url }}" defer></script>
```

Do **not** put the companion in schema `"javascript"` — that puts it back under the 100 KB cap.

### 3. Register minify

In `scripts/minify-theme-extension.mjs`, add a job **without** `limitBytes`:

```js
{
  src: path.join(ROOT, "extensions/smart-filter/assets/smart-filter-<feature>.js"),
  out: path.join(ROOT, "extensions/smart-filter/assets/smart-filter-<feature>.min.js"),
  banner: "/* generated from smart-filter-<feature>.js — do not edit */\n",
}
```

Only `smart-filter.min.js` (schema JS) uses `limitBytes: 100000`.

### 4. CSS overflow

If `smart-filter.css` would exceed 100 KB, add `smart-filter-<feature>.css` and load with `{{ 'smart-filter-<feature>.css' | asset_url }}`. Do not delete existing rules to shrink the schema stylesheet.

## Existing pattern (copy this)

| Role | File | Cap? |
|------|------|------|
| Schema JS | `smart-filter.js` → `smart-filter.min.js` | Yes, 100 KB |
| Companion | `smart-filter-grid.js` → `smart-filter-grid.min.js` | No (Liquid `asset_url`) |

Grid extras already live in the companion so the schema file can stay under the cap.

## Forbidden “fixes”

- Deleting facets, grid takeover, search, drawer, sort, or other live behavior
- Commenting out large functions “temporarily”
- Inlining a worse/minified rewrite by hand
- Pointing schema `"javascript"` at an unminified source that then overflows
