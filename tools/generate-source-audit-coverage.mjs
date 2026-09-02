import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadSpecDungeonMatrices } from "./lib/load-query-data.mjs";
import { buildSourceAuditCoverage } from "./lib/source-audit-coverage.mjs";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(path.join(root, "whelp.json"), "utf8"));
const index = JSON.parse(await readFile(path.join(root, "data", "index.json"), "utf8"));
const audits = await Promise.all((index.sourceClaimAudits ?? []).map(async ({ record }) => (
  JSON.parse(await readFile(path.join(root, "data", record), "utf8"))
)));
const coverage = buildSourceAuditCoverage(await loadSpecDungeonMatrices(root), audits, {
  seasonSlug: manifest.currentSeason,
  currentBuild: manifest.currentBuild,
});
const output = path.join(root, "data", "source-audits", "coverage.json");
await writeFile(output, `${JSON.stringify(coverage, null, 2)}\n`, "utf8");
console.log(`Wrote ${coverage.entries.length} specialization audit-coverage entries to ${path.relative(root, output)}`);
