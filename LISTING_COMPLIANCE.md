# Listing compliance checklist

Use this before every App Store submit or listing update. Shopify rule 4.3.4 rejects statistics and unsubstantiated claims in the listing and in listing images. This app does not have Built for Shopify status.

The phrases this file names are examples of wording to keep out of scanned files. This file is not scanned.

## Copy

- [ ] No Built for Shopify wording, and no BFS wording, in the listing, screenshots, landing page, admin strings, or theme-extension labels.
- [ ] No badge, seal, trophy, shield, certified, or approved-by-Shopify wording.
- [ ] No result numbers or percentages, and no multiplier speed claims.
- [ ] No best, fastest, lightning, powerful, flawless, guaranteed, unlimited, or 100% used as a marketing claim.
- [ ] No outcome promises about sales, conversions, AOV, or growth.
- [ ] No GDPR-ready or GDPR-compliant wording. Privacy copy names the webhook topics the app implements.
- [ ] No AI-powered wording. Spell-check in this app is edit distance and is not shown as a storefront control.
- [ ] No instant-search, instant-suggestions, search-block, Ajax, or re-init wording in listing or landing copy.
- [ ] Plan lines match the code: Standard $11.99 / 200 products / 6 metafield filters / 90-day analytics; Pro $19.99 / 1,000 / 15 / 180; Plus $34.99 / 5,000 / 40 / 365. Development stores: 5,000 products, 25 metafield filters, 90-day analytics. Live shops with no charge: 0 / 0. No trial.
- [ ] `listing/listing-content.md` matches the Partner Dashboard and the landing page.
- [ ] Storefront claims describe collection filters, collection-page search, and filters on the store search results page.

## Images and links

- [ ] Screenshots and the app icon do not show the Shopify logo, a Built for Shopify badge, or stat callouts.
- [ ] Privacy, terms, and support links resolve: `https://findly.srhwebagency.com/privacy`, `/terms`, `/faq`, and `info@srhwebagency.com`.
- [ ] No placeholder host or personal mailbox in listing fields. SMTP login is the same business address.

## Gate

- [ ] `npm run check:claims` exits 0.
- [ ] A person has compared `listing/listing-content.md` with the live Partner form.

## Copy this kit into another app

1. Copy `scripts/check-claims.js`, `scripts/check-claims.allowlist.json`, `LISTING_COMPLIANCE.md`, `listing/listing-content.md`, and `.githooks/pre-commit`.
2. Edit `PUBLIC_ROOTS` and `UI_ROOTS` in `scripts/check-claims.js`.
3. Replace `listing/listing-content.md` with that app's approved listing.
4. Empty the allowlist. Run `npm run check:claims`. Add an entry only for a line that describes the code, with `path`, `patternId`, `contains`, and `reason`.
5. Add `"check:claims": "node ./scripts/check-claims.js"` to `package.json`.
6. Add a CI step that runs `npm run check:claims` after install, after the script exits 0 locally.
7. On each clone, run `git config core.hooksPath .githooks`.
