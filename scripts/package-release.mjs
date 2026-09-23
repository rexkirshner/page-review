import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { zipSync } from "fflate";

/** @typedef {[string, Uint8Array]} ReleaseFile */

/**
 * @param {string} directory
 * @param {string} prefix
 * @returns {Promise<ReleaseFile[]>}
 */
async function collectFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  /** @type {ReleaseFile[]} */
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute, relative));
    else files.push([relative, new Uint8Array(await readFile(absolute))]);
  }
  return files;
}

const files = await collectFiles("dist/release");
if (!files.length) throw new Error("The release build is empty.");
if (files.some(([name]) => name.endsWith(".map"))) throw new Error("Release packages must not contain source maps.");

const manifestBytes = files.find(([name]) => name === "manifest.json")?.[1];
if (!manifestBytes) throw new Error("The release build has no manifest.json.");
const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
if (typeof manifest.version !== "string" || !manifest.version) throw new Error("The manifest has no release version.");

for (const required of ["background.js", "content.js", "icons/icon128.png"]) {
  if (!files.some(([name]) => name === required)) throw new Error(`The release build is missing ${required}.`);
}

await mkdir("release", { recursive: true });
const filename = `page-review-${manifest.version}.zip`;
const releaseTimestamp = new Date(1980, 0, 1);
await writeFile(path.join("release", filename), zipSync(Object.fromEntries(files), { level: 9, mtime: releaseTimestamp }));
console.log(`Created release/${filename} with ${files.length} files.`);
