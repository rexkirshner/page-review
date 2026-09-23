# Chrome Web Store listing copy

## Product details

**Name**

Page Review

**Summary**

Annotate webpages and export structured feedback with text, element, page, and optional screenshot evidence.

**Category**

Developer Tools. This is the closest current public Store category because the extension produces implementation-ready review material. If the authenticated dashboard uses a different category taxonomy, use **Workflow & Planning** as the fallback.

**Language**

English.

## Detailed description

Page Review turns comments on a rendered webpage into structured feedback that can be handed to a developer or coding agent.

Use it to:

- comment on selected text, a rendered element, or the whole page;
- retain complementary DOM evidence that helps identify each target after the page changes;
- optionally attach a marked screenshot of the visible viewport;
- restore local drafts for the same URL;
- export Markdown or JSON, with screenshots included in a ZIP; and
- choose automatic draft expiry after 7, 30, or 90 days, or keep drafts until you clear them.

Page Review works only after you click its toolbar button on an ordinary webpage. It requests no persistent host access. Drafts and screenshots stay in Chrome's extension-owned local storage. There is no account, backend, analytics, advertising, or remote code.

Chrome does not allow extensions to run on browser-internal pages or Chrome Web Store pages. Cross-origin iframe contents and page-owned shadow roots are not available as annotation targets. Screenshots include only the visible viewport.

Review exported feedback before sharing it because URLs, page content, comments, and screenshots can contain personal or confidential information.

## Single-purpose statement

Page Review's single purpose is to let a user annotate the currently viewed webpage and export those annotations with locally captured evidence that identifies each target.

## Permission justifications

**activeTab**

Used only after the user clicks the extension's toolbar action. It grants temporary access to the active page so the extension can capture the annotation target and, only when the user selects **Attach screenshot**, call `captureVisibleTab` for the visible viewport. The extension has no persistent host permissions.

**scripting**

Used to inject the review panel and target-selection logic into the active tab after the user clicks the toolbar action. The script is not injected automatically on page load.

**storage**

Used to store the user's retention setting and versioned annotation drafts in `chrome.storage.local`. Optional screenshot PNGs are stored in extension-owned IndexedDB. Data is stored locally and is not synced or transmitted.

## Remote code

Select **No, I am not using remote code**. Both JavaScript bundles and their only runtime dependency are packaged in the extension ZIP. The implementation makes no network requests.

## Privacy-practices answers

The exact checkbox labels are controlled by the authenticated dashboard, which could not be inspected without the publisher's Google sign-in. Use the following mapping and do not select **No data is handled/collected**:

| Dashboard data type | Answer | What Page Review handles |
| --- | --- | --- |
| Website content | Yes | Selected and nearby text, headings, selected element metadata, accessible names, target geometry, and optional visible-viewport screenshots. |
| Web history or browsing activity | Yes | The full URL and title of a page only when the user creates an annotation. |
| User-generated content | Yes, if this label is offered | The user's annotation comments. |
| User activity | Yes | Target-selection actions plus captured viewport and scroll position associated with an annotation; there is no background behavior tracking. |
| Personal communications | Select only if the dashboard groups user-authored feedback under this label instead of offering user-generated content | Annotation comments are authored for later sharing, but the extension does not read email, chat, or page communications. |
| Personally identifiable information, health information, financial/payment information, authentication information, location | No as product features | The extension does not intentionally request these categories. They can nevertheless appear inside a user-selected page excerpt or screenshot, which is why the privacy policy warns users about sensitive page content. |

For data usage, state that all handling is local, is initiated by the user, and is used only to create, restore, locate, and export annotations. There is no developer access, sale, advertising, analytics, or third-party transfer. The only disclosure is the user's intentional copy or download.

Complete every Limited Use certification: data is used only for the disclosed single purpose, is not sold, is not transferred for unrelated purposes or personalized advertising, is not used for creditworthiness or lending, and is not read by the developer.

## Test instructions for reviewers

No account, payment, special hardware, or external service is required.

1. Open any ordinary `https://` webpage other than a Chrome-internal or Chrome Web Store page.
2. Click the Page Review toolbar action.
3. Use **Add page comment**, or select page text and use **Comment on selection**.
4. Enter a comment and save it. Optionally select **Attach screenshot** first.
5. Choose Markdown or JSON and click **Download**. With a screenshot, the result is a ZIP.
6. Click the toolbar action off and on to confirm the local draft returns.

## Homepage, support, and privacy URLs

Recommended after the source is intentionally published:

- Homepage: the public repository README or a stable project page.
- Support: the public repository's issue tracker with issue creation enabled.
- Privacy policy: https://pages.scratchspace.dev/privacy/page-review/

Before submission, replace the dashboard URL placeholders with the final public URLs and confirm each works in a signed-out/private browser window. Do not use the private Forgejo URL.
