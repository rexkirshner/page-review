import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve(process.argv[2] ?? "dist/privacy-page");
const markdown = await readFile("PRIVACY.md", "utf8");

/** @param {string} value */
function inline(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/** @type {string[]} */
const blocks = [];
/** @type {string[]} */
const paragraph = [];
/** @type {string[]} */
let list = [];

function flushParagraph() {
  if (!paragraph.length) return;
  blocks.push(`<p>${inline(paragraph.join(" "))}</p>`);
  paragraph.length = 0;
}

function flushList() {
  if (!list.length) return;
  blocks.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
  list = [];
}

for (const line of markdown.trim().split("\n")) {
  if (!line.trim()) {
    flushParagraph();
    flushList();
  } else if (line.startsWith("# ")) {
    flushParagraph();
    flushList();
    blocks.push(`<h1>${inline(line.slice(2))}</h1>`);
  } else if (line.startsWith("## ")) {
    flushParagraph();
    flushList();
    blocks.push(`<h2>${inline(line.slice(3))}</h2>`);
  } else if (line.startsWith("- ")) {
    flushParagraph();
    list.push(line.slice(2));
  } else {
    flushList();
    paragraph.push(line.trim());
  }
}
flushParagraph();
flushList();

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Privacy Policy for the Page Review Chrome extension.">
  <title>Page Review Privacy Policy</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f3f0e8; color: #1c211d; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    main { width: min(760px, calc(100% - 32px)); margin: 0 auto; padding: 64px 0 96px; }
    h1 { margin: 0 0 8px; font-size: clamp(2.2rem, 7vw, 4.8rem); line-height: .95; letter-spacing: -.055em; }
    h1 + p { margin-top: 14px; color: #5e665f; font: 700 .78rem/1.5 ui-monospace, "SFMono-Regular", Menlo, monospace; text-transform: uppercase; letter-spacing: .08em; }
    h2 { margin: 48px 0 14px; padding-top: 18px; border-top: 1px solid #bfc2b8; font-size: 1.3rem; letter-spacing: -.02em; }
    p, li { font-size: 1rem; line-height: 1.72; }
    p { margin: 0 0 18px; }
    ul { margin: 0 0 22px; padding-left: 24px; }
    li + li { margin-top: 9px; }
    strong { color: #285c49; }
    code { padding: .14em .35em; border-radius: 4px; background: #e4e1d8; font: .9em ui-monospace, "SFMono-Regular", Menlo, monospace; }
    .notice { margin: 34px 0; padding: 18px 20px; border: 1px solid #da5a37; border-left-width: 6px; border-radius: 8px; background: #fffaf2; }
    footer { margin-top: 56px; color: #697069; font-size: .82rem; }
    @media (max-width: 560px) { main { padding-top: 40px; } h2 { margin-top: 36px; } }
  </style>
</head>
<body>
  <main>
    ${blocks.join("\n    ").replace("<h2>Information handled</h2>", '<div class="notice"><strong>Important:</strong> Page Review handles webpage content, URLs, comments, and optional screenshots locally on your device. Review exports before sharing them.</div>\n    <h2>Information handled</h2>')}
    <footer>Page Review · Privacy Policy</footer>
  </main>
</body>
</html>
`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "index.html"), html);
console.log(`Built privacy page in ${outputDirectory}.`);
