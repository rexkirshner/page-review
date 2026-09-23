import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

type EvidenceModule = typeof import("../../src/browser/dom-evidence");

declare global {
  interface Window {
    FeedbackEvidence: EvidenceModule;
  }
}

const evidenceBundle = build({
  entryPoints: [path.resolve("src/browser/dom-evidence.ts")],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "FeedbackEvidence",
  platform: "browser",
  target: "chrome109",
}).then((result) => {
  const output = result.outputFiles[0];
  if (!output) throw new Error("The DOM evidence test bundle was not generated.");
  return output.text;
});

async function loadFixture(page: Page, body: string): Promise<void> {
  await page.setContent(`<!doctype html><html><head><style>[hidden]{display:none}</style></head><body>${body}</body></html>`);
  await page.addScriptTag({ content: await evidenceBundle });
}

test("text capture crosses inline elements and excludes hidden text", async ({ page }) => {
  await loadFixture(page, "<p id='lead'>Before <strong>visible <span hidden>hidden words</span><em>nested text</em></strong> after.</p>");

  const evidence = await page.evaluate(() => {
    const paragraph = document.querySelector("#lead");
    if (!paragraph) throw new Error("Missing fixture paragraph.");
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return selection ? window.FeedbackEvidence.captureTextEvidence(selection)?.evidence : undefined;
  });

  expect(evidence?.exactQuote).toBe("Before visible nested text after.");
  expect(evidence?.exactQuote).not.toContain("hidden words");
  expect(evidence?.rects.length).toBeGreaterThan(0);
});

test("text relocation falls back after the saved DOM path changes", async ({ page }) => {
  await loadFixture(page, "<main><p id='target'>Leading words target phrase trailing words.</p></main>");

  const result = await page.evaluate(() => {
    const text = document.querySelector("#target")?.firstChild;
    if (!(text instanceof Text)) throw new Error("Missing target text.");
    const start = text.data.indexOf("target phrase");
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, start + "target phrase".length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const captured = selection ? window.FeedbackEvidence.captureTextEvidence(selection) : undefined;
    if (!captured) throw new Error("Text evidence was not captured.");

    document.querySelector("main")?.prepend(document.createElement("div"));
    return window.FeedbackEvidence.locateText(captured.evidence)?.toString();
  });

  expect(result).toBe("target phrase");
});

test("text relocation rejects ambiguous duplicate quotes", async ({ page }) => {
  await loadFixture(page, "<main><p>Duplicate text</p><p>Duplicate text</p></main>");

  const resolved = await page.evaluate(() => {
    const paragraph = document.querySelector("p");
    if (!paragraph) throw new Error("Missing target paragraph.");
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const captured = selection ? window.FeedbackEvidence.captureTextEvidence(selection) : undefined;
    if (!captured) throw new Error("Text evidence was not captured.");

    document.querySelector("main")?.prepend(document.createElement("div"));
    return Boolean(window.FeedbackEvidence.locateText(captured.evidence));
  });

  expect(resolved).toBe(false);
});

test("text relocation uses the captured section heading to disambiguate duplicates", async ({ page }) => {
  await loadFixture(page, "<section id='alpha'><h2>Alpha</h2><p>Duplicate text</p></section><section id='beta'><h2>Beta</h2><p>Duplicate text</p></section>");

  const sectionId = await page.evaluate(() => {
    const paragraph = document.querySelector("#alpha p");
    if (!paragraph) throw new Error("Missing target paragraph.");
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const captured = selection ? window.FeedbackEvidence.captureTextEvidence(selection) : undefined;
    if (!captured) throw new Error("Text evidence was not captured.");

    const wrapper = document.createElement("div");
    paragraph.before(wrapper);
    wrapper.append(paragraph);
    const located = window.FeedbackEvidence.locateText(captured.evidence);
    const element = located?.commonAncestorContainer instanceof Element
      ? located.commonAncestorContainer
      : located?.commonAncestorContainer.parentElement;
    return element?.closest("section")?.id;
  });

  expect(sectionId).toBe("alpha");
});

test("element relocation survives a hierarchy change but rejects ambiguity", async ({ page }) => {
  await loadFixture(page, "<main><button class='action' aria-label='Save item'>Save</button></main><section id='destination'></section>");

  const unique = await page.evaluate(() => {
    const button = document.querySelector("button");
    const destination = document.querySelector("#destination");
    if (!button || !destination) throw new Error("Missing element fixture.");
    const evidence = window.FeedbackEvidence.captureElementEvidence(button);
    destination.append(button);
    return window.FeedbackEvidence.locateElement(evidence)?.textContent;
  });
  expect(unique).toBe("Save");

  await loadFixture(page, "<main id='source'><button class='action' aria-label='Save item'>Save</button></main><section id='destination'></section><aside id='duplicate'></aside>");
  const ambiguous = await page.evaluate(() => {
    const button = document.querySelector("button");
    const destination = document.querySelector("#destination");
    const duplicateContainer = document.querySelector("#duplicate");
    if (!button || !destination || !duplicateContainer) throw new Error("Missing element fixture.");
    const evidence = window.FeedbackEvidence.captureElementEvidence(button);
    duplicateContainer.append(button.cloneNode(true));
    destination.append(button);
    return Boolean(window.FeedbackEvidence.locateElement(evidence));
  });
  expect(ambiguous).toBe(false);
});

test("element relocation uses captured ancestors to break a candidate tie", async ({ page }) => {
  await loadFixture(page, "<section id='alpha'><button class='action' aria-label='Save item'>Save</button></section><section id='beta'><button class='action' aria-label='Save item'>Save</button></section>");

  const sectionId = await page.evaluate(() => {
    const button = document.querySelector("#alpha button");
    if (!button) throw new Error("Missing target button.");
    const evidence = window.FeedbackEvidence.captureElementEvidence(button);
    const wrapper = document.createElement("div");
    button.before(wrapper);
    wrapper.append(button);
    return window.FeedbackEvidence.locateElement(evidence)?.closest("section")?.id;
  });

  expect(sectionId).toBe("alpha");
});
