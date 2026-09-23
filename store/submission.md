# Manual Chrome Web Store submission walkthrough

Only the publisher can complete the account, agreement, payment, identity, URL-hosting, and submission steps below. Do not make the Store review a prerequisite for publishing the source or announcing the project.

## First submission

1. **Choose the permanent publisher account.** Use a Google Account that you expect to retain and monitor long term, preferably dedicated to publishing. Google says the developer-account email cannot be changed after creation; moving later requires a new account and an item transfer. Enable 2-Step Verification before publishing or updating.
2. **Register in the Developer Dashboard.** Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/), accept the current developer agreement and policies, and pay the one-time fee displayed there. Google's public registration page confirms a fee but does not currently state an amount, so treat the signed-in checkout as authoritative.
3. **Complete Publisher/Account settings.** Set the public publisher name, verify the contact email from the verification message, and enable publication/status notifications. Complete any current account or identity verification prompts.
4. **Declare trader status accurately.** A trader acts for a trade, business, craft, or profession; a non-trader acts outside those purposes. If you declare trader status, submit the legal name, contact details, and any documents the dashboard requests, understanding that verified trader information is shown to Store users. This is a legal self-declaration, not a branding preference.
5. **Host the public pages.** The privacy policy is live at https://pages.scratchspace.dev/privacy/page-review/ and has been tested without authentication. After intentional open-source publication, use the repository README for Homepage and its issue tracker for Support, or choose other stable public URLs. Test every URL while signed out. Public GitHub publication still requires separate explicit authorization.
6. **Create the item.** Choose **Add new item**, upload `release/page-review-0.1.0.zip`, and wait for the new pre-submission installation checks to finish. Fix and re-upload before submission if those checks report a platform install or package-validity problem.
7. **Complete Store listing.** Enter the name, summary, detailed description, category, and English language from `store/listing.md`. Upload the prepared screenshots in their numbered order, the 440×280 small promo tile if requested, and optionally the 1400×560 marquee. Enter the final Homepage and Support URLs.
8. **Complete Privacy practices.** Paste the single-purpose statement and the `activeTab`, `scripting`, and `storage` justifications. Declare no remote code. Use the data-type mapping in `store/listing.md`; do not select a no-data answer. Paste the public privacy-policy URL and complete the Limited Use certifications.
9. **Complete test instructions.** Paste the reviewer steps from `store/listing.md`. No credentials are needed.
10. **Choose distribution.** Select **Public** for normal discovery, installation, and automatic Store updates. Choose **Unlisted** only if you intentionally want anyone with the URL to install while keeping the item out of search and category browsing. Both receive the same policy review. Select all regions unless you have a legal or product reason to exclude one, and declare that there are no in-app purchases.
11. **Submit for review.** Run the release checklist once more, then choose **Submit for Review**. Deferred publishing is recommended for the first release: clear the automatic-publish checkbox so approval does not dictate the announcement time. An approved staged submission must be published within 30 days or it returns to draft.
12. **Monitor review.** Watch the dashboard status and the verified publisher email. Google's review guidance says most reviews finish within a few days but some take weeks; use developer support if it remains pending for more than three weeks. New developers and extensions can receive additional scrutiny.
13. **Handle a rejection.** Read the cited policy and affected field/package behavior. If the finding is correct, make the smallest fix, increase the manifest version, run the full verification, upload the new ZIP, update matching listing/privacy text, and resubmit. If the finding is factually wrong, use **Appeal** from the item page with concise evidence. Use One Stop Support for account, trader-verification, or dashboard issues.
14. **Publish after approval.** If publishing was deferred, review the approved package/version and listing one last time, then choose **Publish** before the 30-day deadline. Confirm the public listing, install it in a clean Chrome profile, and verify the Store copy reports the intended version.

## Later Store updates

1. Change `version` in `src/manifest.json` to a value greater than every previously uploaded version.
2. Make the source change and update tests, listing copy, privacy disclosures, or the policy whenever behavior changes.
3. Run `npm ci`, `npm run verify`, and `npm run package:release`.
4. Complete `store/release-checklist.md` against the exact new ZIP.
5. In the item's **Package** tab, choose **Upload New Package**. Update Store listing, Privacy practices, Distribution, or test instructions if needed.
6. Submit the update for review, optionally defer publication, and monitor the dashboard/email. The currently published version remains available until the update is actually published.
7. After publication, Chrome Web Store updates existing installations automatically. Permission additions can require users to approve the new permissions, so avoid them unless the feature truly needs them.

## Local development without Store review

1. Run `npm ci` once, then `npm run build:dev` after each source change.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `dist/dev`.
3. Keep the unpacked directory at that path. Chrome assigns it an identity separate from the Store item, so **Page Review Dev** has separate local drafts, screenshots, and settings and can run alongside **Page Review**.
4. After rebuilding, click **Reload** on the **Page Review Dev** card and refresh any webpage where its panel was open.
5. Use the violet **DEV** toolbar icon and **Page Review Dev** panel title to confirm which channel is active. Local changes are available immediately and never wait for Store review.

## Official Google/Chrome sources checked September 23, 2026

- [Register your developer account](https://developer.chrome.com/docs/webstore/register)
- [Set up your developer account](https://developer.chrome.com/docs/webstore/set-up-account)
- [Prepare your extension](https://developer.chrome.com/docs/webstore/prepare)
- [Creating a great listing page](https://developer.chrome.com/docs/webstore/best-listing)
- [Supplying images](https://developer.chrome.com/docs/webstore/images)
- [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Privacy policy requirements](https://developer.chrome.com/docs/webstore/program-policies/privacy)
- [2026 privacy policy update](https://developer.chrome.com/blog/cws-policy-updates-2026)
- [Trader/non-trader verification](https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure)
- [Distribution visibility](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [Publish for the first time](https://developer.chrome.com/docs/webstore/publish)
- [Update an item](https://developer.chrome.com/docs/webstore/update)
- [Review process and appeals](https://developer.chrome.com/docs/webstore/review-process)
- [2026 review and publication-limit update](https://developer.chrome.com/blog/cws-review-updates-2026)
- [Chrome Web Store API prerequisites (2-Step Verification)](https://developer.chrome.com/docs/webstore/using-api)

The authenticated dashboard was not accessible in the sandbox browser because it requires the publisher's Google sign-in. Older official pages conflict on whether the 440×280 small promo tile is mandatory, and several dashboard guides are dated 2020 or earlier. The bundle therefore includes the small tile, and the signed-in dashboard should be treated as authoritative for the current fee, exact checkbox labels, and any newly required verification field.
