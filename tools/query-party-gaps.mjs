import path from "node:path";
import process from "node:process";
import { buildPartyGapReport } from "./lib/loadout-planner.mjs";
import { loadResponseRecords, loadSpecCapabilities } from "./lib/load-query-data.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const allowed = new Set(["--specs", "--dungeon"]);
const options = new Map();
for (let index = 0; index < args.length; index += 2) {
  if (!allowed.has(args[index]) || args[index + 1] === undefined) throw new Error("Usage: npm run query:party-gaps -- --specs <slug,slug> --dungeon <id>");
  options.set(args[index], args[index + 1]);
}
if (!options.get("--specs") || !options.get("--dungeon")) throw new Error("Usage: npm run query:party-gaps -- --specs <slug,slug> --dungeon <id>");
const requested = options.get("--specs").split(",").map((value) => value.trim()).filter(Boolean);
if (new Set(requested).size !== requested.length) throw new Error("spec slugs must be unique");
const known = await loadSpecCapabilities(root);
const capabilities = requested.map((slug) => {
  const record = known.find((candidate) => candidate.spec.slug === slug);
  if (!record) throw new Error(`unknown spec ${slug}`);
  return record;
});
console.log(JSON.stringify(buildPartyGapReport(await loadResponseRecords(root), capabilities, options.get("--dungeon")), null, 2));
