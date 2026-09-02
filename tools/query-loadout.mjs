import path from "node:path";
import process from "node:process";
import { buildSpecLoadout } from "./lib/loadout-planner.mjs";
import { loadResponseRecords, loadSpecCapabilities } from "./lib/load-query-data.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const allowed = new Set(["--spec", "--dungeon"]);
const options = new Map();
for (let index = 0; index < args.length; index += 2) {
  if (!allowed.has(args[index]) || args[index + 1] === undefined) throw new Error("Usage: npm run query:loadout -- --spec <slug> --dungeon <id>");
  options.set(args[index], args[index + 1]);
}
if (!options.get("--spec") || !options.get("--dungeon")) throw new Error("Usage: npm run query:loadout -- --spec <slug> --dungeon <id>");
const capabilities = await loadSpecCapabilities(root);
const capability = capabilities.find((record) => record.spec.slug === options.get("--spec"));
if (!capability) throw new Error(`unknown spec ${options.get("--spec")}`);
console.log(JSON.stringify(buildSpecLoadout(await loadResponseRecords(root), capability, options.get("--dungeon")), null, 2));
