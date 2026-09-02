import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { queryAbilities } from "./lib/ability-query.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const allowed = new Set(["--index", "--dungeon", "--spell", "--name", "--tag"]);
const options = new Map();
for (let index = 0; index < args.length; index += 2) {
  const flag = args[index];
  const value = args[index + 1];
  if (!allowed.has(flag) || value === undefined) {
    console.error("Usage: npm run query:abilities -- [--dungeon <id>] [--spell <id>] [--name <text>] [--tag <response-tag>] [--index <file.json>]");
    process.exit(2);
  }
  options.set(flag, value);
}

const source = path.resolve(options.get("--index") ?? path.join(root, "data", "abilities", "midnight-season-2.json"));
const index = JSON.parse(await readFile(source, "utf8"));
const spell = options.get("--spell");
const result = queryAbilities(index, {
  dungeonId: options.get("--dungeon"),
  spellId: spell === undefined ? undefined : Number(spell),
  name: options.get("--name"),
  tag: options.get("--tag"),
});
console.log(JSON.stringify(result, null, 2));
