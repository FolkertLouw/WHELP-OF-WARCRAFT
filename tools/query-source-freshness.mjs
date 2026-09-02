import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { compileFreshnessReport, loadProvenanceRecords } from "./lib/source-freshness.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const allowed = new Set(["--as-of", "--include"]);
const options = new Map();
for (let index = 0; index < args.length; index += 2) {
  if (!allowed.has(args[index]) || args[index + 1] === undefined) {
    throw new Error("Usage: npm run query:freshness -- [--as-of <ISO date>] [--include <review|all>]");
  }
  options.set(args[index], args[index + 1]);
}
const include = options.get("--include") ?? "review";
if (!new Set(["review", "all"]).has(include)) throw new Error("--include must be review or all");
const rawAsOf = options.get("--as-of");
const asOf = rawAsOf ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(rawAsOf) ? `${rawAsOf}T23:59:59.999Z` : rawAsOf) : new Date();
if (Number.isNaN(asOf.valueOf())) throw new Error("--as-of must be a valid ISO date or date-time");

const manifest = JSON.parse(await readFile(path.join(root, "whelp.json"), "utf8"));
const policy = JSON.parse(await readFile(path.join(root, "data", "policies", "source-freshness.json"), "utf8"));
const report = compileFreshnessReport({ records: await loadProvenanceRecords(root, policy), policy, currentBuild: manifest.currentBuild, asOf });
console.log(JSON.stringify({
  ...report,
  records: include === "all" ? report.records : report.records.filter((record) => record.needsReview)
}, null, 2));
