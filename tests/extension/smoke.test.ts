import { chromium, expect, test } from "@playwright/test";
import path from "node:path";

test("the packaged MV3 extension starts with its icons and local storage", async () => {
  const extensionPath = path.resolve("dist/release");
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    let [serviceWorker] = context.serviceWorkers();
    serviceWorker ??= await context.waitForEvent("serviceworker");
    expect(serviceWorker.url()).toMatch(/^chrome-extension:\/\/.+\/background\.js$/);

    const result = await serviceWorker.evaluate(async () => {
      const manifest = chrome.runtime.getManifest();
      const key = "smoke-test";
      await chrome.storage.local.set({ [key]: { value: 42 } });
      const stored = await chrome.storage.local.get(key);
      await chrome.storage.local.remove(key);
      return {
        name: manifest.name,
        manifestVersion: manifest.manifest_version,
        actionTitle: manifest.action?.default_title,
        actionIcons: manifest.action?.default_icon,
        badgeText: await chrome.action.getBadgeText({}),
        icons: manifest.icons,
        value: (stored[key] as { value?: unknown } | undefined)?.value,
      };
    });

    expect(result).toEqual({
      name: "Page Review",
      manifestVersion: 3,
      actionTitle: "Toggle Page Review",
      actionIcons: {
        "19": "icons/icon19.png",
        "38": "icons/icon38.png",
      },
      badgeText: "+",
      icons: {
        "16": "icons/icon16.png",
        "32": "icons/icon32.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png",
      },
      value: 42,
    });
  } finally {
    await context.close();
  }
});
