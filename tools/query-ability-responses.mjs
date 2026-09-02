import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { queryAbilityResponses } from "./lib/ability-response-query.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const allowed = new Set(["--dungeon", "--spell", "--action", "--priority"]);
const options = new Map();
for (let index = 0; index < args.length; index += 2) {
  const flag = args[index];
  const value = args[index + 1];
  if (!allowed.has(flag) || value === undefined) {
    console.error("Usage: npm run query:responses -- [--dungeon <id>] [--spell <id>] [--action <action>] [--priority <priority>]");
    process.exit(2);
  }
  options.set(flag, value);
}

const responseIndexPath = path.join(root, "content", "mythic-plus", "midnight-season-2", "abilities", "response-index.json");
const responseIndex = JSON.parse(await readFile(responseIndexPath, "utf8"));
const responseEntries = responseIndex.entries;
const records = await Promise.all(responseEntries.map(async (entry) => JSON.parse(
  await readFile(path.resolve(path.dirname(responseIndexPath), entry.path), "utf8"),
)));
const spell = options.get("--spell");
const result = queryAbilityResponses(records, {
  dungeonId: options.get("--dungeon"),
  spellId: spell === undefined ? undefined : Number(spell),
  action: options.get("--action"),
  priority: options.get("--priority")
});
console.log(JSON.stringify(result, null, 2));
