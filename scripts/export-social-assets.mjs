import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const fontDir = path.join(rootDir, "node_modules/prisma/build/public/assets");
const renderDir = path.join(rootDir, ".next/cache/social-assets");
const execFileAsync = promisify(execFile);
const { default: sharp } = await import("sharp");

const sourceDir = path.join(rootDir, "assets/social");
const publicDir = path.join(rootDir, "public/social");
const assetPngDir = path.join(sourceDir, "png");

const exports = [
  {
    source: "ao-logo-primary.svg",
    output: "ao-logo-primary-1200x630.png",
    width: 1200,
    height: 630,
  },
  {
    source: "ao-avatar.svg",
    output: "ao-avatar-1080x1080.png",
    width: 1080,
    height: 1080,
  },
  {
    source: "ao-profile-banner-x.svg",
    output: "ao-profile-banner-x-1500x500.png",
    width: 1500,
    height: 500,
  },
  {
    source: "ao-share-banner.svg",
    output: "ao-share-banner-1200x630.png",
    width: 1200,
    height: 630,
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
  throw new Error("Chromium is required to render the social assets.");
}

const fontCss = `
@font-face {
  font-family: "Inter";
  src: url("${pathToFileURL(path.join(fontDir, "inter-latin-600-normal.87d718a2.woff2")).href}") format("woff2");
  font-style: normal;
  font-weight: 600;
}
@font-face {
  font-family: "JetBrains Mono";
  src: url("${pathToFileURL(path.join(fontDir, "jetbrains-mono-latin-400-normal.80a5dc9e.woff2")).href}") format("woff2");
  font-style: normal;
  font-weight: 400;
}
`;

await fs.mkdir(publicDir, { recursive: true });
await fs.mkdir(assetPngDir, { recursive: true });
await fs.mkdir(renderDir, { recursive: true });

for (const item of exports) {
  const input = path.join(sourceDir, item.source);
  const publicOutput = path.join(publicDir, item.output);
  const assetOutput = path.join(assetPngDir, item.output);
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
    .extract({ left: 0, top: 0, width: item.width, height: item.height })
    .png({ compressionLevel: 9 })
    .toFile(publicOutput);

  await fs.copyFile(publicOutput, assetOutput);
  console.log(`exported ${item.output}`);
}
