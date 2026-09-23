# Chrome Web Store release checklist

## Build and verification

- [ ] Set a higher `version` in `src/manifest.json` for every Store update.
- [ ] Run `npm ci` with Node.js 20 or newer.
- [ ] Run `npm run verify` and require a zero exit status.
- [ ] Run `npm run package:release` after the final source change.
- [ ] Upload `release/page-review-<version>.zip`, never `dist/dev` or a ZIP made from it.

## Package inspection

- [ ] `manifest.json` is at the ZIP root.
- [ ] The manifest name is `Page Review`, not `Page Review Dev`.
- [ ] The package has exactly these nine files: `manifest.json`, `background.js`, `content.js`, and six icons under `icons/` at 16, 19, 32, 38, 48, and 128 pixels.
- [ ] There are no `.map` files, source files, tests, fixtures, documentation, development icons, development labels, hidden files, or nested wrapper directory.
- [ ] There is no manifest `key`, `update_url`, `host_permissions`, or permission beyond `activeTab`, `scripting`, and `storage`.
- [ ] There are no credentials, private keys, tokens, private paths, localhost references, or remote-code URLs.
- [ ] The ZIP's `manifest.json` version matches the intended submission version.

The automated release test checks the exact file allowlist and scans packaged text for source-map references, development names, private-key markers, local paths, and localhost references.

## Listing and privacy

- [ ] Listing name, summary, description, category, screenshots, and promo artwork match the submitted behavior.
- [ ] The single-purpose statement and all three permission justifications are pasted exactly or kept substantively equivalent.
- [ ] Remote code is declared **No**.
- [ ] Website content, page URL/web activity, user-authored comments, screenshots, and relevant interaction context are disclosed as user data; the form does not claim that no user data is handled.
- [ ] Every Limited Use certification is accurate.
- [ ] The privacy-policy URL is public HTTPS, stable, readable without signing in, and matches the dashboard declarations and package behavior.
- [ ] Homepage and support URLs are public and work while signed out.

## Artwork

- [ ] Store/package icon is a 128×128 PNG.
- [ ] At least one full-bleed screenshot is 1280×800 or 640×400; all submitted screenshots show the current product.
- [ ] The 440×280 small promo tile is available if the dashboard requires it.
- [ ] The optional 1400×560 marquee is current if submitted.
- [ ] No artwork claims Store status, rankings, endorsements, or functionality the extension does not have.

## Manual product check

- [ ] Load `dist/release` unpacked in an isolated Chrome profile and complete the current manual checklist in `docs/manual-testing.md`.
- [ ] Confirm optional screenshot capture, local persistence, Markdown/JSON export, ZIP export, clear feedback, and restricted-page failure behavior.
- [ ] Confirm no unexpected network request is made while annotating, saving, and exporting.
