import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { compileAbilityIndex } from "./lib/ability-index.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const seasonIndex = args.indexOf("--season");
const outputIndex = args.indexOf("--output");
const seasonId = seasonIndex >= 0 ? args[seasonIndex + 1] : "midnight-season-2";
const output = path.resolve(outputIndex >= 0 && args[outputIndex + 1]
  ? args[outputIndex + 1]
  : path.join(root, "data", "abilities", `${seasonId}.json`));

if (!seasonId || !/^[a-z0-9][a-z0-9-]+$/.test(seasonId)) {
  console.error("Usage: npm run generate:ability-index -- [--season <season-id>] [--output <file.json>]");
  process.exit(2);
}

const season = JSON.parse(await readFile(path.join(root, "data", "seasons", `${seasonId}.json`), "utf8"));
const index = JSON.parse(await readFile(path.join(root, "data", "index.json"), "utf8"));
const wanted = new Set(season.dungeons.map((dungeon) => dungeon.id));
const entries = index.dungeons.filter((entry) => wanted.has(entry.id));
const dungeons = await Promise.all(entries.map((entry) => readFile(path.join(root, "data", entry.record), "utf8").then(JSON.parse)));
const abilityRecords = await Promise.all(entries.map((entry) => readFile(path.join(root, "data", entry.enemyAbilities), "utf8").then(JSON.parse)));
const compiled = compileAbilityIndex({ season, dungeons, abilityRecords });
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(compiled, null, 2)}\n`, "utf8");
console.log(`Wrote ${compiled.abilities.length} unique spells from ${compiled.abilityRowCount} ability rows to ${output}`);
