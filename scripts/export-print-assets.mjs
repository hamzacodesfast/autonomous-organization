import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const fontDir = path.join(rootDir, "node_modules/prisma/build/public/assets");
const sourceDir = path.join(rootDir, "assets/print");
const renderDir = path.join(rootDir, ".next/cache/print-assets");
const execFileAsync = promisify(execFile);
const { default: sharp } = await import("sharp");

const exports = [
  {
    source: "local-001-back-mark-offwhite.svg",
    output: "local-001-back-mark-offwhite.png",
    width: 3000,
    height: 1320,
  },
];

const chromiumCandidates = [
  process.env.CHROMIUM_BIN,
  "/snap/bin/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].filter(Boolean);

let chromiumBin;
for (const candidate of chromiumCandidates) {
  try {
    await fs.access(candidate);
    chromiumBin = candidate;
    break;
  } catch {
    // Continue looking for a local Chromium binary.
  }
}

if (!chromiumBin) {
  throw new Error("Chromium is required to render the print assets.");
}

const fontCss = `
@font-face {
  font-family: "Inter";
  src: url("${pathToFileURL(path.join(fontDir, "inter-latin-600-normal.87d718a2.woff2")).href}") format("woff2");
  font-style: normal;
  font-weight: 600;
}
`;

await fs.mkdir(renderDir, { recursive: true });

for (const item of exports) {
  const input = path.join(sourceDir, item.source);
  const output = path.join(sourceDir, item.output);
  const tempOutput = path.join(renderDir, item.output);
  const svg = await fs.readFile(input, "utf8");
  const htmlPath = path.join(renderDir, `${path.parse(item.source).name}.html`);

  await fs.writeFile(
    htmlPath,
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      ${fontCss}
      html,
      body {
        width: ${item.width}px;
        height: ${item.height}px;
        margin: 0;
        overflow: hidden;
        background: transparent;
      }
      svg {
        display: block;
        width: ${item.width}px;
        height: ${item.height}px;
      }
    </style>
  </head>
  <body>${svg}</body>
</html>
`,
  );

  await execFileAsync(chromiumBin, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--default-background-color=00000000",
    `--window-size=${item.width},${item.height + 120}`,
    `--screenshot=${tempOutput}`,
    pathToFileURL(htmlPath).href,
  ]);

  await sharp(tempOutput)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(output);

  console.log(`exported ${path.relative(rootDir, output)}`);
}
