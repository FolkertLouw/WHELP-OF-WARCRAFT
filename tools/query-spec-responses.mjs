import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { querySpecResponses } from "./lib/spec-response-query.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const allowed = new Set(["--spec", "--dungeon", "--spell", "--action", "--priority", "--coverage"]);
const options = new Map();
for (let index = 0; index < args.length; index += 2) {
  if (!allowed.has(args[index]) || args[index + 1] === undefined) {
    console.error("Usage: npm run query:spec-responses -- --spec <slug> [--dungeon <id>] [--spell <id>] [--action <action>] [--priority <priority>] [--coverage full|partial|none]");
    process.exit(2);
  }
  options.set(args[index], args[index + 1]);
}
if (!options.has("--spec")) throw new Error("--spec is required");

const dataIndex = JSON.parse(await readFile(path.join(root, "data", "index.json"), "utf8"));
const capabilities = await Promise.all((dataIndex.specCapabilities ?? []).map(async (entry) => JSON.parse(await readFile(path.join(root, "data", entry.record), "utf8"))));
const capability = capabilities.find((record) => record.spec.slug === options.get("--spec"));
if (!capability) throw new Error(`unknown spec ${options.get("--spec")}`);
const responseIndexPath = path.join(root, "content", "mythic-plus", "midnight-season-2", "abilities", "response-index.json");
const responseIndex = JSON.parse(await readFile(responseIndexPath, "utf8"));
const responses = await Promise.all(responseIndex.entries.map(async (entry) => JSON.parse(await readFile(path.resolve(path.dirname(responseIndexPath), entry.path), "utf8"))));
const spell = options.get("--spell");
console.log(JSON.stringify(querySpecResponses(responses, capability, {
  dungeonId: options.get("--dungeon"),
  spellId: spell === undefined ? undefined : Number(spell),
  action: options.get("--action"),
  priority: options.get("--priority"),
  coverage: options.get("--coverage")
}), null, 2));
