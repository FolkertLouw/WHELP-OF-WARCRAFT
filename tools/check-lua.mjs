import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import luaparse from "luaparse";

const addonRoot = path.resolve(import.meta.dirname, "..", "addon");
const failures = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    files.push(...(entry.isDirectory() ? await walk(target) : [target]));
  }
  return files;
}

const luaFiles = (await walk(addonRoot)).filter((file) => file.endsWith(".lua"));
for (const file of luaFiles) {
  try {
    luaparse.parse(await readFile(file, "utf8"), { luaVersion: "5.1" });
  } catch (error) {
    failures.push(`${path.relative(addonRoot, file)}: ${error.message}`);
  }
}

if (failures.length) {
  console.error(`Lua validation failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Lua validation passed (${luaFiles.length} files checked)`);
