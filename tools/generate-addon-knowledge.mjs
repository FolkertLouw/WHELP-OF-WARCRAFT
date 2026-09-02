import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { compileAddonKnowledge } from "./lib/addon-knowledge.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const seasonIndex = args.indexOf("--season");
const outputIndex = args.indexOf("--output");
const seasonId = seasonIndex >= 0 ? args[seasonIndex + 1] : "midnight-season-2";
const output = path.resolve(outputIndex >= 0 && args[outputIndex + 1]
  ? args[outputIndex + 1]
  : path.join(root, "addon", "WHELPCollector", "GeneratedKnowledge", "EnemyForces.lua"));

if (!seasonId || !/^[a-z0-9][a-z0-9-]+$/.test(seasonId)) {
  console.error("Usage: npm run generate:addon-knowledge -- [--season <season-id>] [--output <file.lua>]");
  process.exit(2);
}

const season = JSON.parse(await readFile(path.join(root, "data", "seasons", `${seasonId}.json`), "utf8"));
const index = JSON.parse(await readFile(path.join(root, "data", "index.json"), "utf8"));
const wanted = new Set(season.dungeons.map((dungeon) => dungeon.id));
const dungeons = await Promise.all(index.dungeons
  .filter((entry) => wanted.has(entry.id))
  .map((entry) => readFile(path.join(root, "data", entry.record), "utf8").then(JSON.parse)));
const lua = compileAddonKnowledge({ season, dungeons });
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, lua, "utf8");
console.log(`Wrote ${dungeons.length} dungeon lookups for ${season.id} to ${output}`);
