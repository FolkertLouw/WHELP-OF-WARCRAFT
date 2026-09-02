import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { querySourceClaims, summarizeSourceClaims } from "./lib/source-claim-query.mjs";

const root = path.resolve(import.meta.dirname, "..");
const index = JSON.parse(await readFile(path.join(root, "data", "index.json"), "utf8"));
const audits = await Promise.all((index.sourceClaimAudits ?? []).map(async ({ record }) => (
  JSON.parse(await readFile(path.join(root, "data", record), "utf8"))
)));

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const filters = {
  disposition: option("--disposition"),
  dungeonId: option("--dungeon"),
  spellId: option("--spell"),
  claimType: option("--type"),
  specSlug: option("--spec"),
  axisId: option("--axis"),
};
const claims = querySourceClaims(audits, filters);

console.log(JSON.stringify({ summary: summarizeSourceClaims(audits), filters, claims }, null, 2));
