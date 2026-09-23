import { chromium, expect } from "@playwright/test";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

/** @typedef {import("@playwright/test").BrowserContext} BrowserContext */
/** @typedef {import("@playwright/test").CDPSession} CDPSession */
/** @typedef {import("@playwright/test").Page} Page */
/** @typedef {import("@playwright/test").Worker} Worker */
/** @typedef {{ backendDOMNodeId?: number, role?: { value?: string }, name?: { value?: string } }} AXNode */

const outputDirectory = path.resolve("store/assets");
const repositoryRoot = path.resolve(".");
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "page-review-store-assets-"));
const extensionPath = path.join(temporaryDirectory, "extension");
const profilePath = path.join(temporaryDirectory, "profile");

/** @type {Record<string, string>} */
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

/** @returns {import("node:http").Server} */
function serveRepository() {
  return createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
      const filename = path.resolve(repositoryRoot, `.${pathname}`);
      if (!filename.startsWith(`${repositoryRoot}${path.sep}`)) throw new Error("Path outside repository.");
      const info = await stat(filename);
      const target = info.isDirectory() ? path.join(filename, "index.html") : filename;
      const content = await readFile(target);
      response.writeHead(200, { "content-type": mimeTypes[path.extname(target)] ?? "application/octet-stream" });
      response.end(content);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });
}

/** @param {CDPSession} session @returns {Promise<AXNode[]>} */
async function axNodes(session) {
  return /** @type {{ nodes: AXNode[] }} */ (await session.send("Accessibility.getFullAXTree")).nodes;
}

/** @param {CDPSession} session @param {string} role @param {string} name @returns {Promise<AXNode>} */
async function findAxNode(session, role, name) {
  /** @type {AXNode[]} */
  let nodes = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    nodes = await axNodes(session);
    const node = nodes.find((candidate) => candidate.role?.value === role && candidate.name?.value === name);
    if (node?.backendDOMNodeId) return node;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const controls = nodes
    .filter((candidate) => candidate.backendDOMNodeId && candidate.role?.value !== "StaticText")
    .map((candidate) => `${candidate.role?.value}:${candidate.name?.value}`)
    .join(", ");
  throw new Error(`${role} named ${name} is not available. Controls: ${controls}`);
}

/**
 * @param {CDPSession} session
 * @param {string} role
 * @param {string} name
 * @param {string} functionDeclaration
 * @param {Array<{ value: unknown }>} [arguments_]
 */
async function callOnAxNode(session, role, name, functionDeclaration, arguments_ = []) {
  const node = await findAxNode(session, role, name);
  const backendDOMNodeId = node.backendDOMNodeId;
  if (backendDOMNodeId === undefined) throw new Error(`${role} named ${name} has no DOM node.`);
  const resolved = await session.send("DOM.resolveNode", { backendNodeId: backendDOMNodeId });
  const objectId = resolved.object.objectId;
  if (!objectId) throw new Error(`${role} named ${name} could not be resolved.`);
  await session.send("Runtime.callFunctionOn", {
    objectId,
    functionDeclaration,
    arguments: arguments_,
    awaitPromise: true,
  });
}

/** @param {CDPSession} session @param {string} role @param {string} name */
async function clickControl(session, role, name) {
  await callOnAxNode(session, role, name, "function() { this.click(); }");
}

/** @param {CDPSession} session @param {string} comment */
async function enterComment(session, comment) {
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

/** @param {Worker} serviceWorker */
async function activeTabId(serviceWorker) {
  return serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error("The fixture tab is unavailable.");
    return tab.id;
  });
}

/** @param {Page} page @param {Worker} serviceWorker */
async function injectContentScript(page, serviceWorker) {
  await page.bringToFront();
  const tabId = await activeTabId(serviceWorker);
  await serviceWorker.evaluate(async (/** @type {{ targetTabId: number }} */ { targetTabId }) => {
    await chrome.scripting.executeScript({ target: { tabId: targetTabId }, files: ["content.js"] });
  }, { targetTabId: tabId });
  await expect(page.locator("[data-page-review]")).toHaveCount(1);
}

/** @type {import("node:http").Server | undefined} */
let server;
/** @type {BrowserContext | undefined} */
let context;

try {
  await mkdir(outputDirectory, { recursive: true });
  await cp(path.resolve("dist/release"), extensionPath, { recursive: true });
  const manifestPath = path.join(extensionPath, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const startedServer = serveRepository();
  server = startedServer;
  await new Promise((resolve, reject) => {
    startedServer.once("error", reject);
    startedServer.listen({ port: 0, host: "127.0.0.1" }, () => resolve(undefined));
  });
  const address = startedServer.address();
  if (!address || typeof address === "string") throw new Error("The asset server did not start.");
  const origin = `http://127.0.0.1:${address.port}`;

  context = await chromium.launchPersistentContext(profilePath, {
    channel: "chromium",
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  let [serviceWorker] = context.serviceWorkers();
  serviceWorker ??= await context.waitForEvent("serviceworker");

  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${origin}/fixture/`);
  await serviceWorker.evaluate(() => chrome.storage.local.clear());
  const session = await context.newCDPSession(page);
  await session.send("Accessibility.enable");
  await session.send("DOM.enable");
  await injectContentScript(page, serviceWorker);

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
  await enterComment(session, "Keep this wording; it explains the workflow clearly.");
  await clickControl(session, "button", "Save comment");

  await clickControl(session, "button", "Select element");
  await page.locator("#details .card").click();
  await enterComment(session, "Align this card with the section heading.");
  await clickControl(session, "button", "Save comment");
  await page.screenshot({ path: path.join(outputDirectory, "screenshot-1-annotate.png") });

  await clickControl(session, "button", "Add page comment");
  await enterComment(session, "Review the overall visual hierarchy on this page.");
  await page.screenshot({ path: path.join(outputDirectory, "screenshot-2-comment.png") });

  await clickControl(session, "checkbox", "Attach screenshot");
  await expect.poll(async () => {
    const nodes = await axNodes(session);
    return !nodes.some((node) => node.name?.value === "Capturing screenshot…");
  }).toBe(true);
  await clickControl(session, "button", "Save comment");
  await page.screenshot({ path: path.join(outputDirectory, "screenshot-3-export.png") });

  const promo = await context.newPage();
  await promo.setViewportSize({ width: 440, height: 280 });
  await promo.goto(`${origin}/store/assets/promo-source.html`);
  await promo.screenshot({ path: path.join(outputDirectory, "small-promo-440x280.png") });
  await promo.setViewportSize({ width: 1400, height: 560 });
  await promo.goto(`${origin}/store/assets/promo-source.html?format=marquee`);
  await promo.screenshot({ path: path.join(outputDirectory, "marquee-1400x560.png") });

  await cp("src/icons/icon128.png", path.join(outputDirectory, "icon-128.png"));
  console.log("Captured Chrome Web Store artwork in store/assets/.");
} finally {
  await context?.close();
  const activeServer = server;
  if (activeServer) await new Promise((resolve, reject) => activeServer.close((error) => error ? reject(error) : resolve(undefined)));
  await rm(temporaryDirectory, { recursive: true, force: true });
}
