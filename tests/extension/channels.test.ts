import { chromium, expect, test } from "@playwright/test";
import path from "node:path";

test("development and release builds coexist with separate extension storage", async () => {
  const developmentPath = path.resolve("dist/dev");
  const releasePath = path.resolve("dist/release");
  const extensionPaths = `${developmentPath},${releasePath}`;
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPaths}`,
      `--load-extension=${extensionPaths}`,
    ],
  });

  try {
    await expect.poll(() => context.serviceWorkers().length).toBe(2);
    const workers = context.serviceWorkers();
    const manifests = await Promise.all(workers.map(async (worker) => ({
      id: new URL(worker.url()).host,
      name: await worker.evaluate(() => chrome.runtime.getManifest().name),
      worker,
    })));
    expect(manifests.map(({ name }) => name).sort()).toEqual(["Page Review", "Page Review Dev"]);
    expect(new Set(manifests.map(({ id }) => id)).size).toBe(2);

    const development = manifests.find(({ name }) => name === "Page Review Dev");
    const release = manifests.find(({ name }) => name === "Page Review");
    expect(development).toBeTruthy();
    expect(release).toBeTruthy();
    await development!.worker.evaluate(() => chrome.storage.local.set({ "channel-test": "development" }));
    expect(await development!.worker.evaluate(() => chrome.storage.local.get("channel-test"))).toEqual({
      "channel-test": "development",
    });
    expect(await release!.worker.evaluate(() => chrome.storage.local.get("channel-test"))).toEqual({});
  } finally {
    await context.close();
  }
});
