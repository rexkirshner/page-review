import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const release = process.argv.includes("--release");

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await build({
  entryPoints: ["src/content/index.ts", "src/background/index.ts"],
  bundle: true,
  outdir: "dist",
  entryNames: "[dir]",
  format: "iife",
  target: "chrome109",
  sourcemap: !release,
  minify: false,
});

await cp("src/manifest.json", "dist/manifest.json");
await cp("src/icons", "dist/icons", { recursive: true });
