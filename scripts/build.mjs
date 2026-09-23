import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const release = process.argv.includes("--release");
const development = process.argv.includes("--dev");
if (release === development) throw new Error("Choose exactly one build channel: --dev or --release.");

const channel = development ? "dev" : "release";
const outputDirectory = `dist/${channel}`;
const manifest = JSON.parse(await readFile("src/manifest.json", "utf8"));

if (development) {
  manifest.name = "Page Review Dev";
  manifest.version_name = `${manifest.version} dev`;
  manifest.description = "Development build of Page Review for local testing.";
  manifest.action.default_title = "Toggle Page Review Dev";
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await build({
  entryPoints: ["src/content/index.ts", "src/background/index.ts"],
  bundle: true,
  outdir: outputDirectory,
  entryNames: "[dir]",
  format: "iife",
  target: "chrome109",
  sourcemap: development,
  minify: false,
  define: {
    __PAGE_REVIEW_DISPLAY_NAME__: JSON.stringify(development ? "Page Review Dev" : "Page Review"),
    __PAGE_REVIEW_PANEL_TITLE__: JSON.stringify(development ? "Page Review Dev" : "Page Review"),
  },
});

await writeFile(`${outputDirectory}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
await cp(development ? "src/icons-dev" : "src/icons", `${outputDirectory}/icons`, { recursive: true });

console.log(`Built ${channel} extension in ${outputDirectory}.`);
