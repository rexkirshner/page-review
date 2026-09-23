# Feedback Packet

Feedback Packet is a local-first Chrome extension for attaching comments to selected text, rendered elements, or an entire page. It exports Markdown or JSON with the captured page context and several complementary DOM locators. Optional screenshots are packaged with the feedback in a ZIP.

The extension does not use a backend or call an LLM. Drafts and screenshots remain in the browser until they expire, the extension is removed, or the user clears them.

Feedback Packet captures page content and context only after you choose an annotation target. This can include the page URL, nearby text, element attributes, and the visible viewport. Review [Privacy](PRIVACY.md) before using it on sensitive pages.

## Install the unpacked extension

Requirements: Node.js 20 or newer and a current version of Chrome.

```sh
npm ci
npm run build
```

Then:

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose the generated `dist` directory.
4. Pin **Feedback Packet** if desired.

Click the toolbar action on an ordinary web page to turn feedback mode on for that tab. Refreshing or navigating turns it off; clicking the action again restores that page's saved draft.

After rebuilding and reloading the unpacked extension, refresh any pages that already had feedback mode open. Chrome invalidates their old content-script context when an extension is reloaded.

## Use

- Drag over page text, then choose **Comment on selection**.
- Choose **Select element**, hover the page, use **Parent** or **Child** if needed, then click the intended element.
- For keyboard targeting, choose **Select element**, use Tab or the arrow keys to choose a DOM element, then press Enter.
- Choose **Add page comment** for feedback that has no rendered target.
- Screenshots are off by default. The visible viewport is captured only when **Attach screenshot** is checked, and the image is retained when the comment is saved.
- Choose a saved comment to scroll to and flash its target. A target is marked unresolved when it cannot be matched confidently.
- Download Markdown or JSON. When screenshots are attached, the download is a ZIP containing the feedback file and one PNG per attached annotation.

**Copy feedback** copies the textual format only. Use **Download** to include screenshots.

## Development

```sh
npm run check   # TypeScript
npm test        # Pure-core Node tests
npm run test:browser # DOM capture and relocation tests in Chromium
npm run test:extension # Packaged extension smoke test in Chromium
npm run build   # MV3 bundles in dist/
npm run package:release # Source-map-free release ZIP in release/
npm run verify  # All of the above
```

Install the browser used by the automated DOM tests once after `npm ci`:

```sh
npx playwright install chromium
```

For a package without source maps, use `npm run build:release`.

Serve the test fixture from the repository root, then open `/fixture/`:

```sh
python3 -m http.server 4173
```

The fixture includes inline formatting, nested elements, duplicate text, mutable targets, hash routes, canvas content, and a page-owned shadow root. Follow [the manual test checklist](docs/manual-testing.md) for browser-only behavior.

## Permissions

- `activeTab`: temporarily accesses only the tab where the user clicks the toolbar action; it is also required by `captureVisibleTab`.
- `scripting`: injects feedback mode after that click.
- `storage`: stores versioned draft metadata in `chrome.storage.local`.

There are no persistent host permissions. Screenshot blobs use extension-owned IndexedDB rather than the 10 MB default `storage.local` quota, so `unlimitedStorage` is not requested. See [Architecture](docs/architecture.md) for the decision and current Chrome references.

The complete local data-handling policy is in [Privacy](PRIVACY.md).

## Limitations

- Chrome blocks content-script injection on browser-internal pages such as `chrome://` pages and on the Chrome Web Store.
- Cross-origin iframe contents cannot be targeted from the top-level page.
- Content inside page-owned shadow roots is not traversed.
- Canvas pixels can be included in a screenshot but cannot be identified as DOM text or elements.
- DOM evidence identifies the rendered target. It does not identify a source file, framework component, or template.
- Screenshots cover the visible viewport only. They are not full-page captures.

## Architecture and formats

[Architecture](docs/architecture.md) describes module boundaries, the data flow, schema and format versions, storage, re-location confidence, and non-obvious decisions.

## Contributing

Keep changes small and include tests for pure data, migration, locator, retention, or export behavior. Run `npm run verify` and the relevant parts of the manual checklist before opening a pull request.

## License

[MIT](LICENSE)
