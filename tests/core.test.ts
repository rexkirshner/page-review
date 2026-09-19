import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";
import {
  appendDraftAnnotation,
  editDraftAnnotationComment,
  removeDraftAnnotation,
  setDraftAnnotationResolution,
  setDraftAnnotationScreenshot,
} from "../src/core/draft";
import { userFacingError } from "../src/core/errors";
import { buildZip, exportJson, exportMarkdown } from "../src/core/export";
import { buildCssPath, cssEscape, looksStable, scoreElementCandidate } from "../src/core/locator";
import { readDraft } from "../src/core/migrations";
import { DRAFT_SCHEMA_VERSION, type Draft } from "../src/core/model";
import { pageKey, TRACKING_PARAMS } from "../src/core/page-key";
import { expiresAt, isExpired } from "../src/core/retention";
import { deduplicateRects, projectRectToBitmap } from "../src/core/screenshot-geometry";
import { normalizeSettings } from "../src/core/settings";

const now = "2026-09-19T12:00:00.000Z";

function sampleDraft(): Draft {
  return {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    id: "draft-1",
    pageKey: "https://example.com/path?view=wide#details",
    createdAt: now,
    lastEditedAt: now,
    annotations: [
      {
        id: "annotation-1",
        type: "text",
        comment: "Keep this wording exactly.",
        createdAt: now,
        updatedAt: now,
        resolution: "unresolved",
        context: {
          url: "https://example.com/path?view=wide#details",
          title: "Example page",
          capturedAt: now,
          viewport: { width: 1200, height: 800 },
          scroll: { x: 0, y: 300 },
          devicePixelRatio: 2,
          userAgent: "Test browser",
        },
        target: {
          kind: "text",
          exactQuote: "text across inline elements",
          range: {
            startContainer: { indexes: [1, 2, 0] },
            startOffset: 2,
            endContainer: { indexes: [1, 2, 2, 0] },
            endOffset: 8,
          },
          containingElements: {
            start: { tag: "p", classes: [], attributes: {}, cssPath: "main > p" },
            end: { tag: "strong", classes: [], attributes: {}, cssPath: "main > p > strong" },
            common: { tag: "p", classes: [], attributes: {}, cssPath: "main > p" },
          },
          before: "Some leading ",
          after: " and trailing text.",
          sectionContext: "Details",
          rects: [{ x: 20, y: 40, width: 200, height: 18 }],
        },
        screenshot: {
          filename: "annotation-1.png",
          capturedAt: now,
          width: 2400,
          height: 1600,
        },
      },
    ],
  };
}

test("page keys remove only the documented tracking parameters", () => {
  assert.deepEqual(TRACKING_PARAMS, ["utm_*", "fbclid", "gclid"]);
  assert.equal(
    pageKey("https://example.com/a?utm_source=x&view=wide&FBCLID=abc&x=1#part"),
    "https://example.com/a?view=wide&x=1#part",
  );
  assert.equal(pageKey("https://example.com/a?campaign=1#one"), "https://example.com/a?campaign=1#one");
  assert.notEqual(pageKey("https://example.com/a#one"), pageKey("https://example.com/a#two"));
});

test("locator helpers keep stable identifiers and score complementary evidence", () => {
  assert.equal(looksStable("checkout-button"), true);
  assert.equal(looksStable("css-12a3bc45"), false);
  assert.equal(
    buildCssPath([
      { tag: "button", classes: ["primary"], nthOfType: 2 },
      { tag: "section", id: "billing" },
      { tag: "main" },
    ]),
    "#billing > button.primary:nth-of-type(2)",
  );
  const expected = {
    tag: "button",
    id: "pay",
    classes: ["primary"],
    attributes: { "aria-label": "Pay now" },
    text: "Pay",
    accessibleName: "Pay now",
  };
  assert.equal(scoreElementCandidate(expected, expected), 1);
  assert.ok(scoreElementCandidate(expected, { ...expected, id: "other", text: "Submit" }) < 0.7);
  assert.equal(scoreElementCandidate(expected, { ...expected, tag: "a" }), 0);
  const textOnly = { tag: "p", classes: [], attributes: {}, text: "Original content" };
  assert.equal(scoreElementCandidate(textOnly, textOnly), 1);
  assert.equal(scoreElementCandidate(textOnly, { ...textOnly, text: "Replacement content" }), 0.2);
});

test("CSS locator escaping handles identifiers that are valid HTML but need CSS escapes", () => {
  assert.equal(cssEscape("1 item"), "\\31 \\ item");
  assert.equal(cssEscape("-1item"), "-\\31 item");
  assert.equal(cssEscape("a:b"), "a\\:b");
  assert.equal(cssEscape("\0name"), "\uFFFDname");
});

test("retention expires from last edit and supports never", () => {
  const edited = "2026-09-01T00:00:00.000Z";
  assert.equal(expiresAt(edited, 7), Date.parse("2026-09-08T00:00:00.000Z"));
  assert.equal(isExpired({ lastEditedAt: edited }, 7, Date.parse("2026-09-08T00:00:00.000Z")), true);
  assert.equal(isExpired({ lastEditedAt: edited }, 30, Date.parse("2026-09-08T00:00:00.000Z")), false);
  assert.equal(expiresAt(edited, null), null);
});

test("settings accept only supported retention values and return independent defaults", () => {
  assert.deepEqual(normalizeSettings({ retentionDays: 30 }), { retentionDays: 30 });
  assert.deepEqual(normalizeSettings({ retentionDays: null }), { retentionDays: null });
  assert.deepEqual(normalizeSettings({ retentionDays: 14 }), { retentionDays: 7 });
  assert.deepEqual(normalizeSettings("invalid"), { retentionDays: 7 });

  const first = normalizeSettings(undefined);
  first.retentionDays = 90;
  assert.deepEqual(normalizeSettings(undefined), { retentionDays: 7 });
});

test("extension reload errors tell the user how to recover", () => {
  assert.equal(
    userFacingError(new Error("Extension context invalidated."), "The action failed."),
    "The extension was reloaded. Refresh this page and turn feedback mode on again.",
  );
  assert.equal(userFacingError(new Error("Storage failed."), "The action failed."), "Storage failed.");
  assert.equal(userFacingError(undefined, "The action failed."), "The action failed.");
});

test("screenshot target rectangles scale and clip to the visible viewport", () => {
  assert.deepEqual(
    projectRectToBitmap(
      { x: 100, y: 50, width: 200, height: 100 },
      { width: 1200, height: 800 },
      { width: 2400, height: 1600 },
    ),
    { x: 200, y: 100, width: 400, height: 200 },
  );
  assert.deepEqual(
    projectRectToBitmap(
      { x: -20, y: 760, width: 100, height: 100 },
      { width: 1200, height: 800 },
      { width: 2400, height: 1600 },
    ),
    { x: 0, y: 1520, width: 160, height: 80 },
  );
  assert.equal(
    projectRectToBitmap(
      { x: 1300, y: 20, width: 100, height: 100 },
      { width: 1200, height: 800 },
      { width: 2400, height: 1600 },
    ),
    undefined,
  );
});

test("duplicate range rectangles are removed without merging distinct fragments", () => {
  const first = { x: 10, y: 20, width: 30, height: 15 };
  const second = { x: 40, y: 20, width: 25, height: 15 };
  assert.deepEqual(deduplicateRects([first, second, { ...first }]), [first, second]);
});

test("draft migration handles v0 and rejects corrupt or future drafts", () => {
  const draft = sampleDraft();
  const current = readDraft(draft);
  assert.equal(current.status, "ok");
  if (current.status === "ok") assert.equal(current.migrated, false);

  const legacy = { ...draft, schemaVersion: 0, updatedAt: draft.lastEditedAt };
  delete (legacy as Partial<Draft>).lastEditedAt;
  const migrated = readDraft(legacy);
  assert.equal(migrated.status, "ok");
  if (migrated.status === "ok") {
    assert.equal(migrated.migrated, true);
    assert.equal(migrated.draft.schemaVersion, 1);
  }

  assert.equal(readDraft("bad").status, "corrupt");
  assert.equal(readDraft({ ...draft, annotations: [{ id: "broken", type: "text", comment: "Missing evidence" }] }).status, "corrupt");
  assert.equal(readDraft({ ...draft, lastEditedAt: "not a date" }).status, "corrupt");
  assert.equal(readDraft({
    ...draft,
    annotations: [{ ...draft.annotations[0], type: "element" }],
  }).status, "corrupt");
  assert.equal(readDraft({
    ...draft,
    annotations: [{
      ...draft.annotations[0],
      target: {
        ...draft.annotations[0].target,
        range: {
          ...(draft.annotations[0].target?.kind === "text" ? draft.annotations[0].target.range : {}),
          startOffset: -1,
        },
      },
    }],
  }).status, "corrupt");
  assert.equal(readDraft({
    ...draft,
    annotations: [{
      ...draft.annotations[0],
      target: { ...draft.annotations[0].target, exactQuote: "" },
    }],
  }).status, "corrupt");
  assert.equal(readDraft({
    ...draft,
    annotations: [draft.annotations[0], { ...draft.annotations[0] }],
  }).status, "corrupt");
  assert.equal(readDraft({
    ...draft,
    annotations: [{
      ...draft.annotations[0],
      screenshot: { ...draft.annotations[0].screenshot!, filename: "../feedback.md" },
    }],
  }).status, "corrupt");
  assert.equal(readDraft({ schemaVersion: 99 }).status, "unsupported");
  assert.equal(readDraft(undefined).status, "missing");
});

test("draft updates are immutable and centralize last-edited timestamps", () => {
  const draft = sampleDraft();
  const editedAt = "2026-09-20T00:00:00.000Z";
  const edited = editDraftAnnotationComment(draft, "annotation-1", "Changed verbatim.", editedAt);
  assert.equal(draft.annotations[0].comment, "Keep this wording exactly.");
  assert.equal(edited.annotations[0].comment, "Changed verbatim.");
  assert.equal(edited.annotations[0].updatedAt, editedAt);
  assert.equal(edited.lastEditedAt, editedAt);

  const withoutScreenshot = setDraftAnnotationScreenshot(edited, "annotation-1", undefined, editedAt);
  assert.equal(withoutScreenshot.annotations[0].screenshot, undefined);
  assert.ok(edited.annotations[0].screenshot);

  const resolved = setDraftAnnotationResolution(withoutScreenshot, "annotation-1", "resolved");
  assert.equal(resolved.annotations[0].resolution, "resolved");
  assert.equal(resolved.lastEditedAt, withoutScreenshot.lastEditedAt);
  assert.equal(resolved.annotations[0].updatedAt, withoutScreenshot.annotations[0].updatedAt);

  const removed = removeDraftAnnotation(resolved, "annotation-1", editedAt);
  assert.equal(removed.annotations.length, 0);
  const readded = appendDraftAnnotation(removed, draft.annotations[0]);
  assert.equal(readded.annotations.length, 1);
  assert.throws(() => appendDraftAnnotation(readded, draft.annotations[0]), /already exists/);
  assert.throws(() => editDraftAnnotationComment(draft, "missing", "No", editedAt), /does not exist/);
});

test("Markdown and JSON exports carry equivalent comments, evidence, and versions", () => {
  const draft = sampleDraft();
  const markdown = exportMarkdown(draft, now);
  const json = JSON.parse(exportJson(draft, now));
  assert.match(markdown, /- Format version: 1/);
  assert.match(markdown, /Keep this wording exactly\./);
  assert.match(markdown, /- Resolved: No/);
  assert.match(markdown, /annotation-1\.png/);
  assert.equal(json.formatVersion, 1);
  assert.equal(json.annotations[0].comment, "Keep this wording exactly.");
  assert.equal(json.annotations[0].target.exactQuote, "text across inline elements");
});

test("Markdown escapes evidence whitespace that would break a list item", () => {
  const draft = sampleDraft();
  const target = draft.annotations[0].target;
  if (!target || target.kind !== "text") throw new Error("Expected text target");
  target.exactQuote = "labels\n  Duplicate";
  target.before = "\n  Repeated ";

  const markdown = exportMarkdown(draft, now);
  assert.ok(markdown.includes('- Exact quote: "labels\\n  Duplicate"'));
  assert.ok(markdown.includes('- Before: "\\n  Repeated "'));
});

test("ZIP export contains the feedback file and referenced PNG", () => {
  const bytes = new Uint8Array([137, 80, 78, 71]);
  const zip = unzipSync(buildZip("feedback.md", "# Feedback\n", { "annotation-1.png": bytes }));
  assert.deepEqual(Object.keys(zip).sort(), ["annotation-1.png", "feedback.md"]);
  assert.equal(strFromU8(zip["feedback.md"]), "# Feedback\n");
  assert.deepEqual(zip["annotation-1.png"], bytes);
});
