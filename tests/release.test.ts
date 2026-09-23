import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { unzipSync } from "fflate";

test("the public release archive contains only the installable extension", async () => {
  const sourceManifest = JSON.parse(await readFile("src/manifest.json", "utf8"));
  const archive = unzipSync(new Uint8Array(await readFile(`release/feedback-packet-${sourceManifest.version}.zip`)));
  const names = Object.keys(archive).sort();
  assert.deepEqual(names, [
    "background.js",
    "content.js",
    "icons/icon128.png",
    "icons/icon16.png",
    "icons/icon19.png",
    "icons/icon32.png",
    "icons/icon38.png",
    "icons/icon48.png",
    "manifest.json",
  ]);
  assert.equal(names.some((name) => name.endsWith(".map")), false);

  const manifest = JSON.parse(new TextDecoder().decode(archive["manifest.json"]));
  assert.equal(manifest.name, "Feedback Packet");
  assert.equal(manifest.version, sourceManifest.version);
  assert.equal(manifest.manifest_version, 3);
});
