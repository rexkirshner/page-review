import { chromium, expect, test, type BrowserContext, type CDPSession, type Page, type Worker } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";

const fixture = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Workflow fixture</title></head>
  <body>
    <main>
      <h1 id="heading">Workflow fixture</h1>
      <p id="lead">Before <strong>selected words</strong> after.</p>
      <button id="target">Target button</button>
    </main>
  </body>
</html>`;

interface AXNode {
  backendDOMNodeId?: number;
  role?: { value?: string };
  name?: { value?: string };
  properties?: Array<{ name: string; value?: { value?: unknown } }>;
}

async function axNodes(session: CDPSession): Promise<AXNode[]> {
  const result = await session.send("Accessibility.getFullAXTree") as { nodes: AXNode[] };
  return result.nodes;
}

async function findAxNode(session: CDPSession, role: string, name: string): Promise<AXNode> {
  const nodes = await axNodes(session);
  const node = nodes.find((candidate) => candidate.role?.value === role && candidate.name?.value === name);
  expect(node, `${role} named ${name} should be exposed to accessibility. Available controls: ${nodes
    .filter((candidate) => candidate.backendDOMNodeId && candidate.role?.value !== "StaticText")
    .map((candidate) => `${candidate.role?.value}:${candidate.name?.value}`)
    .join(", ")}`).toBeTruthy();
  expect(node?.backendDOMNodeId).toBeTruthy();
  return node!;
}

async function callOnAxNode(
  session: CDPSession,
  role: string,
  name: string,
  functionDeclaration: string,
  arguments_: Array<{ value: unknown }> = [],
): Promise<void> {
  const node = await findAxNode(session, role, name);
  const backendDOMNodeId = node.backendDOMNodeId;
  if (backendDOMNodeId === undefined) throw new Error(`${role} named ${name} has no DOM node.`);
  const resolved = await session.send("DOM.resolveNode", { backendNodeId: backendDOMNodeId }) as {
    object: { objectId?: string };
  };
  const objectId = resolved.object.objectId;
  if (!objectId) throw new Error(`${role} named ${name} could not be resolved.`);
  await session.send("Runtime.callFunctionOn", {
    objectId,
    functionDeclaration,
    arguments: arguments_,
    awaitPromise: true,
  });
}

async function clickControl(session: CDPSession, role: string, name: string): Promise<void> {
  await callOnAxNode(session, role, name, "function() { this.click(); }");
}

async function enterComment(session: CDPSession, comment: string): Promise<void> {
  await callOnAxNode(
    session,
    "textbox",
    "COMMENT",
    `function(value) {
      this.value = value;
      this.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, data: value, inputType: "insertText" }));
    }`,
    [{ value: comment }],
  );
}

async function activeTabId(serviceWorker: Worker): Promise<number> {
  return serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error("The workflow tab is unavailable.");
    return tab.id;
  });
}

async function injectContentScript(page: Page, serviceWorker: Worker): Promise<void> {
  await page.bringToFront();
  const tabId = await activeTabId(serviceWorker);
  await serviceWorker.evaluate(async ({ targetTabId }) => {
    await chrome.scripting.executeScript({ target: { tabId: targetTabId }, files: ["content.js"] });
  }, { targetTabId: tabId });
  await expect(page.locator("[data-feedback-packet]")).toHaveCount(1);
}

test("the built extension completes its critical local workflow", async () => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "feedback-packet-e2e-"));
  const extensionPath = path.join(temporaryDirectory, "extension");
  await cp(path.resolve("dist"), extensionPath, { recursive: true });
  const manifestPath = path.join(extensionPath, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.host_permissions = ["<all_urls>"];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  let server: Server | undefined;
  let context: BrowserContext | undefined;

  try {
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(fixture);
    });
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("The workflow server did not start.");

    context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: true,
      acceptDownloads: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    let [serviceWorker] = context.serviceWorkers();
    serviceWorker ??= await context.waitForEvent("serviceworker");
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await serviceWorker.evaluate(() => chrome.storage.local.clear());
    const session = await context.newCDPSession(page);
    await session.send("Accessibility.enable");
    await session.send("DOM.enable");

    await injectContentScript(page, serviceWorker);
    await clickControl(session, "button", "Add page comment");
    await enterComment(session, "Page workflow comment");
    await clickControl(session, "button", "Save comment");

    await page.evaluate(() => {
      const text = document.querySelector("strong")?.firstChild;
      if (!text) throw new Error("The selection fixture is missing.");
      const range = document.createRange();
      range.selectNodeContents(text);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    await clickControl(session, "button", "Comment on selection");
    await enterComment(session, "Text workflow comment");
    await clickControl(session, "button", "Save comment");

    await clickControl(session, "button", "Select element");
    await page.locator("#target").click();
    await enterComment(session, "Element workflow comment");
    await clickControl(session, "checkbox", "Attach screenshot");
    await page.waitForTimeout(250);
    await expect.poll(async () => {
      const nodes = await axNodes(session);
      const save = nodes.find((node) => node.role?.value === "button" && node.name?.value === "Save comment");
      const disabled = save?.properties?.some((property) => property.name === "disabled" && property.value?.value === true);
      return Boolean(save) && !disabled && !nodes.some((node) => node.name?.value === "Capturing screenshot…");
    }).toBe(true);
    await clickControl(session, "button", "Save comment");
    await expect.poll(async () => {
      const values = Object.values(await serviceWorker.evaluate(() => chrome.storage.local.get(null)));
      const saved = values.find((value) => typeof value === "object" && value !== null && "annotations" in value) as {
        annotations?: unknown[];
      } | undefined;
      return saved?.annotations?.length ?? 0;
    }).toBe(3);

    const stored = await serviceWorker.evaluate(() => chrome.storage.local.get(null));
    const draft = Object.values(stored).find((value) => typeof value === "object" && value !== null && "annotations" in value) as {
      annotations?: Array<{ comment?: string; screenshot?: { filename?: string } }>;
    } | undefined;
    expect(draft?.annotations?.map((annotation) => annotation.comment)).toEqual([
      "Page workflow comment",
      "Text workflow comment",
      "Element workflow comment",
    ]);
    expect(draft?.annotations?.[2]?.screenshot?.filename).toMatch(/\.png$/);

    const downloadPromise = page.waitForEvent("download");
    await clickControl(session, "button", "Download");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^feedback-.+\.zip$/);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const archive = unzipSync(new Uint8Array(await import("node:fs/promises").then(({ readFile }) => readFile(downloadPath!))));
    expect(Object.keys(archive).sort()).toEqual(expect.arrayContaining(["feedback.md"]));
    expect(Object.keys(archive).some((name) => name.endsWith(".png"))).toBe(true);

    const tabId = await activeTabId(serviceWorker);
    await serviceWorker.evaluate(async ({ targetTabId }) => {
      await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: () => { delete window.__feedbackPacketController; },
      });
    }, { targetTabId: tabId });
    await injectContentScript(page, serviceWorker);
    expect((await axNodes(session)).filter((node) => node.role?.value === "region" && node.name?.value === "Feedback Packet")).toHaveLength(1);

    await page.reload();
    await injectContentScript(page, serviceWorker);
    const reloadedComments = (await axNodes(session))
      .filter((node) => node.role?.value === "button")
      .map((node) => node.name?.value);
    expect(reloadedComments).toEqual(expect.arrayContaining([
      "Page workflow comment page",
      "Text workflow comment text",
      "Element workflow comment element · screenshot",
    ]));
  } finally {
    await context?.close();
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
