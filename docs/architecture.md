# Architecture

## Boundaries

The extension has five intentionally narrow parts:

| Part | Location | Responsibility |
| --- | --- | --- |
| Data model | `src/core/model.ts` | Versioned draft and export types. No DOM or Chrome APIs. |
| Browser capture | `src/browser/dom-evidence.ts`, `screenshot.ts` | Read rendered DOM evidence, re-locate targets, capture and mark the visible viewport. |
| Persistence | `src/browser/persistence.ts`, `src/background/image-store.ts` | Store draft JSON and settings in `chrome.storage.local`; store PNG blobs in extension-owned IndexedDB. |
| Export | `src/core/export.ts` | Pure Markdown, JSON, and ZIP generation. |
| UI | `src/content/` | Closed-shadow-root panel, editor, target overlays, and user actions. |

The service worker in `src/background/index.ts` has only three jobs: inject feedback mode after a toolbar click, call `captureVisibleTab`, and broker access to the image database. Adding an export format belongs in `src/core`; adding a target type belongs in browser capture plus the versioned model.

## Data flow

1. A toolbar click grants temporary `activeTab` access and injects `content.js`.
2. The content script normalizes the page URL and loads its draft. Loading applies migrations and retention.
3. Text or element evidence is captured synchronously from the rendered page. Page context is captured at the same time.
4. The shadow host is hidden for two animation frames. The service worker captures the active viewport. The content script draws an orange marker onto the resulting bitmap using `bitmap size / CSS viewport size` on each axis. This accounts for device pixel ratio and browser scaling without assuming they are identical.
5. The editor opens. The marked image remains only in memory unless **Attach screenshot** is checked.
6. Draft JSON is written through `chrome.storage.local`. Attached PNG blobs are written through the service worker to IndexedDB under `<draft-id>:<annotation-id>`.
7. Export is generated from captured evidence only. The page is never re-scraped at export time.

Full page loads remove the content script. While feedback mode is active, the content script also watches the URL so hash changes and client-side history navigation turn the mode off without requiring persistent navigation permissions.

## Page identity and retention

The page key is `origin + path + query + hash`. `utm_*`, `fbclid`, and `gclid` are the complete tracking-parameter strip list; it is exported as `TRACKING_PARAMS` in `src/core/page-key.ts`. Parameter order is preserved. Any other query or hash difference creates a distinct draft.

`lastEditedAt` changes when an annotation is added, edited, deleted, or its screenshot changes. Viewing, toggling feedback mode, resolving targets, and exporting do not change it. Expiry is checked only when a draft is loaded. The available retention periods are 7, 30, or 90 days, or never.

## Draft schema

Draft schema version: **1**.

A draft contains a stable draft ID, page key, creation and last-edit times, and ordered annotations. Every annotation contains:

- a stable ID, current target type, verbatim comment, creation/update times, and current resolved state;
- the URL, title, capture time, viewport, scroll position, device pixel ratio, and user agent at annotation time;
- either text evidence, element evidence, or no target for a page comment; and
- an optional PNG reference with filename, dimensions, and capture time.

Text evidence includes the exact quote, serialized start/end node paths and offsets, summaries of the start/end/common containing elements, surrounding text, nearby section heading, and client rects. Element evidence includes tag, stable-looking ID/classes, `data-*` and `aria-*` attributes, visible text, accessible name, CSS path, identifying ancestors, and bounding rect.

Version 0 drafts are migrated explicitly by moving `updatedAt` to `lastEditedAt` and supplying the resolution field. Invalid or future-version drafts are preserved and blocked from overwrite until the user chooses **Clear feedback**.

## Target re-location

Text first uses the serialized DOM range and confirms the exact quote, surrounding context, and containing-element evidence. If the path no longer works, a fallback accepts only one candidate that also matches those complementary signals. Hidden text is excluded. This supports ranges spanning inline elements without wrapping or mutating page nodes.

Elements first try the captured CSS path, then score same-tag candidates using ID, stable classes, selected attributes, accessible name, and visible text. The match must exceed a confidence threshold and be meaningfully better than the runner-up. A target with no complementary identifying evidence is unresolved rather than attached using the CSS path alone.

Resolved targets are displayed with fixed overlays inside a closed extension shadow root. Page scripts cannot inspect the panel's comments or transient download elements, and the page DOM is not wrapped or rewritten.

## Export formats

Markdown and JSON format version: **1**. Both contain page identity, export time, ordered annotations, verbatim comments, resolution state, annotation-time page context, target evidence, and screenshot filenames. Markdown is arranged for direct reading; JSON preserves the versioned structured representation.

Without screenshots, the extension downloads one `.md` or `.json` file. With screenshots, it creates a ZIP containing `feedback.md` or `feedback.json` and each referenced `<annotation-id>.png`. Copying returns only the selected text format.

## Storage decision

Chrome documents a 10 MB default limit for `chrome.storage.local`, expandable with `unlimitedStorage`. Viewport PNGs can exhaust that limit after only a few annotations. IndexedDB supports blobs in extension service workers and keeps image bytes separate from small, inspectable draft metadata, so screenshots use IndexedDB and the extension does not request `unlimitedStorage`.

Primary references:

- [Chrome Tabs API: `captureVisibleTab`](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab)
- [Chrome Storage API: limits and storage areas](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Extension service worker lifecycle: persistent storage options](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [The `activeTab` permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)

## Screenshot consistency

All extension UI, saved target markers, and selection previews share one shadow host. Hiding that host removes them from `captureVisibleTab`. The target rect is captured first, then drawn into the PNG afterward. This avoids page reflow and ensures the exported image contains a single permanent marker rather than transient UI.

Page comments have no rendered target, so their optional screenshot is an unmarked viewport record.

## Limits

Injection restrictions, cross-origin iframes, page-owned shadow roots, and canvas are not worked around. These limits are preferable to broad host permissions, DOM dumping, or uncertain matches. The extension captures visible, target-related evidence only and does not infer source code locations.
