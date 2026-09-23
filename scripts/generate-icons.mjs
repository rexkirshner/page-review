import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const sizes = [16, 19, 32, 38, 48, 128];
const variants = [
  { source: "assets/icon.svg", output: "src/icons", master: "assets/icon-master.png" },
  { source: "assets/icon-dev.svg", output: "src/icons-dev", master: "assets/icon-dev-master.png" },
];

const browser = await chromium.launch({ channel: "chromium", headless: true });

try {
  for (const variant of variants) {
    const svg = await readFile(variant.source, "utf8");
    await mkdir(variant.output, { recursive: true });

    for (const size of sizes) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`);
      await page.screenshot({ path: path.join(variant.output, `icon${size}.png`), omitBackground: true });
      await page.close();
    }

    const master = await browser.newPage({ viewport: { width: 720, height: 720 } });
    await master.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`);
    await master.screenshot({ path: variant.master, omitBackground: true });
    await master.close();
  }
} finally {
  await browser.close();
}

console.log("Generated production and development icon PNGs.");
