# Partner listing copy

Paste the fields in `listing/listing-content.md`. This file matches that source.

## NavMenu vs listing

| Nav item | Route | Listing? |
|---|---|---|
| Home | `/app` | Yes |
| Filters | `/app/filters` | Yes |
| Search | `/app/search` | Yes. Fields, fuzzy matching, fallback, and stop words for collection-page search |
| Settings | `/app/settings` | Yes |
| Translation | `/app/translation` | Yes |
| Analytics | `/app/analytics` | Yes. Filter usage |
| Pricing plans | `/app/billing` | Yes |
| Contact | `/app/contact` | No. Listing support: `info@srhwebagency.com` |

There is no Integrations admin page.

## Paste into Partner Dashboard

### App name (30 / limit 30)

```
Findly: Smart Filters & Search
```

### App card subtitle (57 / limit 62)

```
Collection filters and search for Online Store 2.0 themes
```

### App introduction (76 / limit 100)

```
Add collection filters and collection search to your Online Store 2.0 theme.
```

### App details (483 / limit 500)

```
Findly adds collection filters to Online Store 2.0 themes. Filter by price, availability, vendor, type, tags, options, and mapped metafields. Placement can be left, right, or top. Collection pages can show a search field inside that collection. Filters can also show on the store search results page. If Judge.me, Wishlist Hero, or Weglot is already on the page, Findly calls that app after the grid updates. Analytics shows filter usage. Plans: Development, Standard, Pro, and Plus.
```

### Features (limit 80 each)

1. Filter collections by price, availability, vendor, type, tags, and options.
2. Map product metafields to filters and choose which collections they apply to.
3. Add collection filters on Online Store 2.0 themes with a theme app block.
4. Search within a collection from the collection filters field.
5. Show filters on the store search results page.

### Search terms (max 5)

1. collection filters
2. product filters
3. metafield filters
4. collection search
5. shopify filters

### Title tag (47 / limit 60)

```
Findly: collection filters for Online Store 2.0
```

### Meta description (102 / limit 160)

```
Collection filters, collection-page search, and metafield mapping for Shopify Online Store 2.0 themes.
```

### Integrations

1. Judge.me
2. Wishlist Hero
3. Weglot

Remove Froonze and Swym.

### Partner search tags to clear

Untick these Partner search tags: Autocomplete, Instant search, Search bar, Search suggestions, Synonym groups, Search tags.

The collection search field filters the current collection. It does not render a suggestion list or a header search field. Synonym expansion is not applied on that field.

### Resources

Privacy policy URL

```
https://findly.srhwebagency.com/privacy
```

Terms of service URL

```
https://findly.srhwebagency.com/terms
```

Support email

```
info@srhwebagency.com
```

Pricing URL

```
https://findly.srhwebagency.com/terms#billing
```

### Pricing

No trial. USD, every 30 days.

| Plan | Price | Products | Metafield filters | Analytics |
|---|---|---|---|---|
| Development | $0 | 5,000 on development stores; 0 on a live shop with no paid plan | 25 on development stores; 0 on a live shop with no paid plan | 90 days |
| Standard | $11.99 | 200 | 6 | 90 days |
| Pro | $19.99 | 1,000 | 15 | 180 days |
| Plus | $34.99 | 5,000 | 40 | 365 days |

#### Plan: free

Display name: `Development`

```
Up to 5,000 products, 25 filters
90-day analytics
For development stores
```

#### Plan: standard

Display name: `Standard`

```
Up to 200 products, 6 filters
90-day analytics
```

#### Plan: pro

Display name: `Pro`

```
Up to 1,000 products, 15 filters
180-day analytics
```

#### Plan: plus

Display name: `Plus`

```
Up to 5,000 products, 40 filters
365-day analytics
```

## Reviewer testing instructions

Demo collection:

```
https://findly-test-store.myshopify.com/collections/all
```

Admin: `https://admin.shopify.com/store/findly-test-store`

Put real storefront password, collaborator code, screencast URL, and emergency phone into Partner — never placeholder text.

There is no trial. Development is $0 (development stores: 5,000 products, 25 metafield filters, 90-day analytics). A live shop with no paid plan has 0 products and 0 metafield filters. Standard is $11.99 every 30 days (200 products, 6 metafield filters, 90-day analytics). Pro is $19.99 (1,000 products, 15 metafield filters, 180-day analytics). Plus is $34.99 (5,000 products, 40 metafield filters, 365-day analytics).

1. Install and open Home. Run catalog sync and wait until it finishes.
2. Open Filters. Enable a filter set for price, availability, vendor, type, tags, or options.
3. In the theme editor, add the app block named Collection filters to the collection template and save. Fallback: App embeds, then Collection filters (app embed). The embed loads on collection and search templates.
4. Open the demo collection and use the filters. The product grid updates.
5. In Settings, turn on Allow searching within collection pages. Return to the collection. The search field filters that collection.
6. Optional: turn on Show filters on the search results page, add Collection filters to the search template, and open the store search results page.
7. Admin Search sets the fields, fuzzy matching, fallback, and stop words used by that collection search field. Pricing plans shows the caps above. Analytics shows filter usage. Translation edits widget labels.

Theme editor names: Collection filters (section block, collection and search templates). Collection filters (app embed) (body embed). Ignore any other Findly section that renders no filter UI.
