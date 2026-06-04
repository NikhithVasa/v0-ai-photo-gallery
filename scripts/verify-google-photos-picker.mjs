import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const rootsToScan = ["app", "components", "hooks", "lib"];
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const pickerModulePath = path.join(projectRoot, "lib/google-photos-picker.ts");

const forbiddenValues = [
  ["photoslibrary", "googleapis.com"].join("."),
  ["https://www.googleapis.com/auth", "photoslibrary"].join("/"),
];
const requiredValues = [
  "https://photospicker.googleapis.com/v1",
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
];

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(entryPath)));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

const files = (
  await Promise.all(
    rootsToScan.map((root) => listSourceFiles(path.join(projectRoot, root))),
  )
).flat();
const violations = [];

for (const file of files) {
  const contents = await readFile(file, "utf8");
  for (const forbiddenValue of forbiddenValues) {
    if (contents.includes(forbiddenValue)) {
      violations.push(`${path.relative(projectRoot, file)} contains ${forbiddenValue}`);
    }
  }
}

const pickerModule = await readFile(pickerModulePath, "utf8");
for (const requiredValue of requiredValues) {
  if (!pickerModule.includes(requiredValue)) {
    violations.push(`lib/google-photos-picker.ts is missing ${requiredValue}`);
  }
}

if (violations.length) {
  console.error("Google Photos Picker API verification failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Google Photos imports use the Photos Picker API and picker-only scope.");
