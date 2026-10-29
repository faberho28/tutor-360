// Copies the OpenCV.js build that ships with the npm package to public/opencv,
// so the browser downloads it from our own origin (with real progress) instead
// of the bundler inlining 13 MB into a chunk. It runs on postinstall; the copy
// is git-ignored and pinned by the lockfile like any other dependency.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

let pkgPath;
try {
  pkgPath = require.resolve("@techstark/opencv-js/package.json");
} catch {
  // A partial install must not break `pnpm install`; the app reports the
  // missing file when it tries to load OpenCV.
  console.warn("[copy-opencv] @techstark/opencv-js is not installed, skipping");
  process.exit(0);
}

const source = join(dirname(pkgPath), "dist", "opencv.js");
const targetDir = join(appRoot, "public", "opencv");
const target = join(targetDir, "opencv.js");
const bytes = statSync(source).size;

if (!existsSync(target) || statSync(target).size !== bytes) {
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(source, target);
}

// The loader reads the decoded size from here: Content-Length is the
// compressed size when the server compresses, so it cannot give a progress.
const { version } = require(pkgPath);
writeFileSync(
  join(targetDir, "manifest.json"),
  JSON.stringify({ version, bytes }),
);
console.log(
  `[copy-opencv] opencv.js ${version} (${bytes} bytes) -> public/opencv`,
);
