# Manual test checklist

Build the extension, load `dist` as an unpacked extension, and serve the fixture as described in the README. Unless a step says otherwise, begin with a cleared draft.

## Selection and comments

- [ ] Select text that crosses the plain, `strong`, hidden `span`, and `em` nodes in the lead paragraph. Confirm the blue preview covers only rendered text and the exported quote/context omit “hidden fixture words.”
- [ ] Save the text comment and confirm its numbered orange target remains aligned while scrolling.
- [ ] Enter element-selection mode. Confirm hover preview does not activate links or buttons.
- [ ] Use **Parent** and **Child** on the sample card, then click. Confirm the preview identifies the intended target before saving.
- [ ] Add a page comment and confirm it has no target marker.
- [ ] Add at least three comments. Confirm numbers follow list order and stay stable through editing.
- [ ] Edit one comment and verify its text changes without changing the target.
- [ ] Delete one comment and verify the displayed numbers close the gap.
- [ ] Select a saved comment and confirm the page scrolls to and flashes the target.

## Mode and persistence

- [ ] Click the toolbar action while feedback mode is on. Confirm the panel and every marker disappear and ordinary page clicks work.
- [ ] Turn feedback mode on again without reloading. Confirm the draft returns.
- [ ] Follow a hash route or trigger client-side history navigation. Confirm feedback mode turns off; turn it on again and confirm the destination page key's draft loads.
- [ ] Refresh. Confirm feedback mode is off; click the action and confirm the draft returns.
- [ ] Restart Chrome, reopen the same URL, turn feedback mode on, and confirm the draft returns.
- [ ] Create drafts at `#overview` and `#details`; confirm they remain distinct.
- [ ] Add `utm_source=test` to one URL and confirm it restores the same draft.
- [ ] Add a non-tracking query such as `?layout=wide` and confirm it uses a distinct draft.

## Resolution and retention

- [ ] Select only the initial sentence in the dynamic target and save it. Turn feedback mode off, choose **Replace target**, then turn feedback mode on again. Confirm the original comment is retained and reported as unresolved rather than attached to the replacement text.
- [ ] Annotate the replacement sentence, turn feedback mode off, choose **Remove target**, then turn feedback mode on again. Confirm both earlier comments remain in the draft and both targets are unresolved.
- [ ] Annotate one of the duplicate-text paragraphs, change the DOM path, and confirm the duplicate quote is not used as an ambiguous fallback.
- [ ] Temporarily seed or edit a draft's `lastEditedAt` in extension storage to exceed the chosen retention period. Load it and confirm the draft and its images are deleted.
- [ ] Choose 7, 30, 90 days, and never; reload after each and confirm the setting persists.
- [ ] View, toggle, and export a draft; inspect storage and confirm `lastEditedAt` is unchanged.
- [ ] Edit a comment and confirm `lastEditedAt` changes.
- [ ] Choose **Clear feedback**, cancel, and confirm nothing changes. Repeat and confirm; verify the draft and screenshot records are removed.

## Screenshots

- [ ] Create an annotation without checking **Attach screenshot**. Confirm the export contains no image and IndexedDB has no record for it.
- [ ] Create an annotation with **Attach screenshot**. Confirm the PNG contains the page and one orange target marker, with no panel, editor, numbered saved markers, or blue preview.
- [ ] Repeat near the top and after a long scroll. Confirm the marker aligns with the target in both images.
- [ ] Repeat at device scale/DPR 1 and 2. Confirm marker position and thickness are correct and the saved dimensions match the PNG.
- [ ] Resize the viewport and confirm the screenshot includes only the visible viewport.
- [ ] Choose **Recapture** after scrolling or changing the viewport. Confirm the PNG and capture timestamp change only then.
- [ ] Choose **Remove image** and confirm later exports no longer reference or contain it.
- [ ] Capture several realistic viewport PNGs and restart Chrome. Confirm every image remains available and draft metadata remains below the `storage.local` quota.

## Export

- [ ] Download Markdown without screenshots: one `.md` file.
- [ ] Download JSON without screenshots: one `.json` file.
- [ ] Download Markdown with screenshots: one ZIP containing `feedback.md` plus every referenced `<annotation-id>.png` and no extra files.
- [ ] Download JSON with screenshots: one ZIP containing `feedback.json` plus the same PNGs.
- [ ] Compare Markdown and JSON: confirm they carry the same comments, context, resolution state, evidence, and screenshot references, each with format version 1.
- [ ] Confirm comments are byte-for-byte as entered and contain no added interpretation or overall instruction.
- [ ] Choose **Copy feedback** without screenshots and paste the text.
- [ ] Choose it with screenshots and confirm the panel states that download is required to include them.
- [ ] Export and confirm the draft remains present and `lastEditedAt` is unchanged.

## Boundaries

- [ ] Confirm the extension reports or fails cleanly on `chrome://` and Chrome Web Store pages.
- [ ] Confirm top-level content remains selectable when a cross-origin iframe is present, but iframe contents are not offered as targets.
- [ ] Confirm the page-owned shadow-root example is not traversed.
- [ ] Confirm the canvas can be selected only as an element; pixels or drawn text cannot be selected as DOM content.
