# Privacy Policy for Page Review

Effective date: September 23, 2026

This Privacy Policy describes how the Page Review Chrome extension handles information. In this policy, “Page Review,” “the extension,” “we,” and “us” refer to the Page Review extension and its developer.

## Scope

This policy applies only to the Page Review extension. It does not govern the webpages you annotate, Google Chrome, the Chrome Web Store, your device or operating system, or any person or service with whom you later share exported feedback. Those products and services operate under their own terms and privacy policies.

## Summary

Page Review is a local-first tool. It has no developer-operated backend, account system, advertising, analytics SDK, or remote artificial-intelligence service. The extension does not intentionally transmit annotation comments, webpage content, URLs, screenshots, drafts, or settings to us or to another party.

The extension does handle user data locally on your device. This local handling is necessary to create, save, restore, locate, and export webpage annotations. Nothing is copied or downloaded from the extension unless you initiate that action.

## Information handled

When you use Page Review, the extension may handle the following information on your device:

- **User-generated content:** annotation comments that you enter.
- **Web activity:** the full URL and title of a page that you annotate.
- **Website content:** selected or nearby rendered text, section headings, selected element text and attributes, accessible names, DOM locators, element summaries, and target rectangles.
- **Screenshots:** an image of the visible viewport only when you select **Attach screenshot**.
- **Technical context:** capture time, viewport dimensions, scroll position, device pixel ratio, and browser user-agent string.
- **Extension settings:** your selected draft-retention period. The selected export format is held only while the panel is open.

Depending on the target, recorded website evidence may include:

- selected text, nearby rendered text, section headings, DOM paths, element summaries, and target rectangles;
- visible element text, stable-looking IDs and classes, selected `data-*` and `aria-*` attributes, accessible names, ancestor summaries, and a CSS path; or
- no target evidence for a page-level comment.

The full URL may contain sensitive query parameters or fragments. Selected text, nearby text, element attributes, comments, and screenshots may contain personal, confidential, financial, health, authentication, or other sensitive information even though Page Review does not intentionally seek those categories.

## When handling occurs

Page Review receives temporary access to a webpage only after you click its toolbar action. Page evidence is recorded only when you choose an annotation target. A screenshot is captured only when you select **Attach screenshot**. The extension does not continuously monitor browsing activity, run on every page automatically, or request persistent access to all websites.

## How information is used

The extension uses handled information only to provide its single purpose: creating, saving, restoring, locating, displaying, and exporting webpage annotations with enough evidence to identify their targets.

Page Review does not use handled information for advertising, behavioral profiling, marketing, credit decisions, lending, surveillance, generalized research, model training, or any purpose unrelated to that user-facing function.

## Developer collection and access

We do not operate a server that receives extension drafts or screenshots. We do not receive or have routine access to the comments, page content, URLs, screenshots, or settings handled by the extension. We cannot recover local drafts for you.

Chrome and the Chrome Web Store may independently process installation, update, crash, review, rating, or aggregate usage information under Google’s own terms and privacy policies. Page Review does not add analytics code or receive page-level annotation data through those services.

## Storage and retention

Draft metadata is stored in `chrome.storage.local`. Attached PNG files are stored in extension-owned IndexedDB. These storage areas are associated with the installed extension in your Chrome profile.

The default retention period is seven days after the last edit. You may choose 30 days, 90 days, or no automatic expiry. Expiry is checked when a draft is loaded, so expired data may remain on the device until the relevant draft is opened or you clear it.

You may delete an annotation, remove an attached image, or use **Clear feedback** to remove the current page’s draft and associated images. Removing the extension normally removes its extension-owned storage under Chrome’s extension lifecycle. Copies in downloads, clipboards, device backups, browser-profile backups, or third-party systems are outside the extension’s control and may remain after local deletion.

## Export and disclosure

Page Review does not choose a recipient or automatically share information.

**Copy feedback** writes the selected text format to your clipboard without image bytes. **Download** creates a Markdown or JSON file, or a ZIP when screenshots are attached. After information is copied, downloaded, uploaded, messaged, committed to a repository, or otherwise shared by you, its handling is controlled by you and the receiving person or service—not by Page Review.

Review every export before sharing it. Removing a comment or image from the extension does not remove copies you previously exported or shared.

## Data sale and third-party transfers

Page Review does not sell user data. It does not transfer handled user data to the developer, data brokers, advertisers, analytics providers, artificial-intelligence providers, or other third parties. The only disclosure of annotation data occurs when you intentionally copy or download an export and then decide where to send or store it.

## Permissions

- `activeTab` grants temporary access only after you click the extension action and permits capture of the visible tab when you request a screenshot.
- `scripting` injects the feedback interface into that active tab.
- `storage` saves local settings and draft metadata.

The extension requests no persistent host permissions and no `unlimitedStorage` permission.

## Security and limitations

Page Review is designed to keep annotation data on your device and to avoid network transmission by the extension. However, no software, browser profile, device, local storage mechanism, clipboard, downloaded file, or backup system can be guaranteed completely secure or permanently erasable.

Anyone with sufficient access to your device, Chrome profile, downloaded files, clipboard, backups, or chosen sharing destination may be able to access exported or locally stored information. Webpages and third-party services may also have their own security risks. You are responsible for maintaining appropriate device security, access controls, backups, and safe handling of exports.

## Your responsibilities

Use Page Review only on pages and information you are authorized to access, annotate, capture, and share. Do not intentionally capture passwords, authentication tokens, private keys, payment-card data, protected health information, confidential client material, personal data, or other sensitive information unless you have a lawful and appropriate reason and have secured the resulting local data and exports.

You are responsible for reviewing exports, selecting recipients, complying with applicable contracts and laws, and obtaining any permission required from the owner or subject of the information.

## Children’s privacy

Page Review is a general-purpose productivity tool and is not directed to children under 13. Because the extension has no account or developer-operated data-collection service, we do not knowingly receive personal information from children through the extension. Users should not use the extension to capture or share children’s personal information without appropriate authority and safeguards.

## This policy webpage

The public copy of this policy may be hosted by ScratchSpace and served through Cloudflare. Those infrastructure providers may process ordinary web-request information, such as IP address, user agent, timestamps, and requested URL, and the hosting platform may add a Cloudflare Web Analytics beacon. That hosting activity is separate from the Page Review extension. The policy webpage does not receive annotation drafts, webpage content, comments, or screenshots from the extension.

## Changes to this policy

We may update this policy when the extension, applicable requirements, or hosting arrangements change. The effective date above identifies the current version. Any release that begins handling user data in a materially different way must update this policy and provide any additional prominent in-product disclosure or consent required before the new handling begins.

## Contact

For privacy questions about Page Review, use the support contact identified on its Chrome Web Store listing. Do not include passwords, authentication tokens, confidential webpage content, or unredacted screenshots in a support request.
