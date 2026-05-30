import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** @param {string} dir */
function collectTestFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      files.push(...collectTestFiles(path));
    } else if (name.endsWith(".test.ts")) {
      files.push(path);
    }
  }
  return files;
}

const files = collectTestFiles("src");
if (files.length === 0) {
  console.error("No test files found under src/");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...files],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
