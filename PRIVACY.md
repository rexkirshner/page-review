# Privacy

Feedback Packet processes page information locally so that you can identify a rendered target and export useful feedback. It has no backend, does not use analytics, does not call an LLM, and does not transmit captured page data to the developer or another service.

## Information handled

When you create an annotation, the extension records your comment and page context such as the full URL, title, capture time, viewport and scroll position, device pixel ratio, and browser user agent. Depending on the target, it also records:

- selected text, nearby rendered text, section headings, DOM paths, element summaries, and target rectangles;
- visible element text, stable-looking IDs and classes, selected `data-*` and `aria-*` attributes, accessible names, ancestor summaries, and a CSS path; or
- no target evidence for a page-level comment.

The full URL can contain sensitive query parameters or fragments. Selected and nearby text, element attributes, and screenshots can contain personal or confidential page content.

The extension captures the visible viewport only when you select **Attach screenshot**. The image remains in memory until you save or cancel the comment. Saved screenshots are stored locally and included only in downloaded ZIP exports.

## Storage and retention

Draft metadata is stored in `chrome.storage.local`. Attached PNG files are stored in extension-owned IndexedDB. The default retention period is seven days after the last edit; you can choose 30 days, 90 days, or no automatic expiry. Expiry is checked when a draft is loaded.

You can delete one annotation, remove an attached image, or use **Clear feedback** to remove the current page's draft and images. Removing the extension removes its extension-owned storage under Chrome's normal extension lifecycle.

## Export and sharing

Nothing is exported without your action. **Copy feedback** writes the selected text format to the clipboard without image bytes. **Download** creates a Markdown or JSON file, or a ZIP when screenshots are attached. After export, the downloaded or copied material is outside the extension's control; review it before sharing.

## Permissions

- `activeTab` grants temporary access only after you click the extension action and allows the visible tab to be captured.
- `scripting` injects feedback mode into that tab.
- `storage` saves settings and draft metadata locally.

The extension requests no persistent host permissions and no `unlimitedStorage` permission.

## Changes

Material changes to this policy should accompany the release that changes the extension's data handling.

Last updated: September 19, 2026.
