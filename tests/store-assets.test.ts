import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function pngDimensions(filename: string): Promise<{ width: number; height: number }> {
  const bytes = await readFile(filename);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("Chrome Web Store artwork has the required dimensions", async () => {
  const assets = new Map([
    ["store/assets/icon-128.png", { width: 128, height: 128 }],
    ["store/assets/screenshot-1-annotate.png", { width: 1280, height: 800 }],
    ["store/assets/screenshot-2-comment.png", { width: 1280, height: 800 }],
    ["store/assets/screenshot-3-export.png", { width: 1280, height: 800 }],
    ["store/assets/small-promo-440x280.png", { width: 440, height: 280 }],
    ["store/assets/marquee-1400x560.png", { width: 1400, height: 560 }],
  ]);

  for (const [filename, expected] of assets) assert.deepEqual(await pngDimensions(filename), expected, filename);
});
