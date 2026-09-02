import { readFile } from "node:fs/promises";
import path from "node:path";
import { querySourceAuditCoverage } from "./lib/source-audit-coverage.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const coverage = JSON.parse(await readFile(path.join(root, "data", "source-audits", "coverage.json"), "utf8"));
const filters = { level: option("--level"), specSlug: option("--spec") };
console.log(JSON.stringify({ summary: coverage.summary, filters, entries: querySourceAuditCoverage(coverage, filters) }, null, 2));
