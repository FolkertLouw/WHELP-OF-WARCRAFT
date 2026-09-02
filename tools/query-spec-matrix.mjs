import path from "node:path";
import process from "node:process";
import { loadSpecCapabilities, loadSpecDungeonMatrices } from "./lib/load-query-data.mjs";
import { querySpecMatrix } from "./lib/spec-matrix-query.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const allowed = new Set(["--spec", "--dungeon", "--affix", "--rating"]);
const options = new Map();
for (let index = 0; index < args.length; index += 2) {
  if (!allowed.has(args[index]) || args[index + 1] === undefined) {
    throw new Error("Usage: npm run query:spec-matrix -- --spec <slug> [--dungeon <id>] [--affix <slug>] [--rating <always|niche|none>]");
  }
  options.set(args[index], args[index + 1]);
}
if (!options.has("--spec")) throw new Error("--spec is required");

console.log(JSON.stringify(querySpecMatrix(
  await loadSpecDungeonMatrices(root),
  await loadSpecCapabilities(root),
  {
    spec: options.get("--spec"),
    dungeon: options.get("--dungeon"),
    affix: options.get("--affix"),
    rating: options.get("--rating"),
  },
), null, 2));
