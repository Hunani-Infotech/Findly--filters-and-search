# Findly partner integrations

After Ajax hide/show of the theme product grid, Findly dispatches `findlyFilterRenderCompleted` on **window** and **document**. Existing Findly code also fires `smart-filter:update` with `{ handles }`.

## Listen for the render-completed event

```html
<script>
  window.addEventListener("findlyFilterRenderCompleted", function () {
    // Re-init review / wishlist / badge widgets on remaining product cards.
  });
</script>
```

## Built-in re-init

Findly re-inits these after each Ajax grid update:

- **Judge.me** — `jdgm.customizeBadges`
- **Wishlist Hero** — `.wishlist-hero-custom-button`
- **Weglot** — `Weglot.refresh`
- **Shopify Markets / theme currency converter** — `Currency.convertAll`

Froonze wishlist and Swym Wishlist Plus are also treated as built-in. Flair and Sami badges should listen for `findlyFilterRenderCompleted`.

## Product-data translation

Product-data translation uses **Shopify Translate & Adapt** (and the storefront locale). Theme cards keep locale HTML; they are **not** rebuilt from English Admin API JSON. Weglot is an additional overlay that is refreshed after Ajax.
