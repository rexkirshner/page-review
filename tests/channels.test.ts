import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function manifest(channel: "dev" | "release") {
  return JSON.parse(await readFile(`dist/${channel}/manifest.json`, "utf8"));
}

test("development and release builds have separate identities", async () => {
  const development = await manifest("dev");
  const release = await manifest("release");

  assert.equal(development.name, "Page Review Dev");
  assert.equal(development.version_name, `${release.version} dev`);
  assert.equal(development.action.default_title, "Toggle Page Review Dev");
  assert.equal(release.name, "Page Review");
  assert.equal("version_name" in release, false);
  assert.equal(release.action.default_title, "Toggle Page Review");

  const developmentIcon = await readFile("dist/dev/icons/icon128.png");
  const releaseIcon = await readFile("dist/release/icons/icon128.png");
  assert.notDeepEqual(developmentIcon, releaseIcon);
});

test("only the development build contains source maps and development labels", async () => {
  const developmentContent = await readFile("dist/dev/content.js", "utf8");
  const releaseContent = await readFile("dist/release/content.js", "utf8");
  const developmentMap = await readFile("dist/dev/content.js.map", "utf8");

  assert.match(developmentContent, /Page Review Dev/);
  assert.match(developmentMap, /src\/content\/index\.ts/);
  assert.doesNotMatch(releaseContent, /Page Review Dev|Review Dev|Feedback Packet|sourceMappingURL/);
  await assert.rejects(readFile("dist/release/content.js.map", "utf8"), { code: "ENOENT" });
});
