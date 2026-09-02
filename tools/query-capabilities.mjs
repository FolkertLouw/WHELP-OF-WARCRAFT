import path from "node:path";
import process from "node:process";
import { queryCapabilities } from "./lib/capability-query.mjs";
import { loadSpecCapabilities, loadSpecCapabilityCoverage } from "./lib/load-query-data.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const allowed = new Set(["--specs", "--action", "--scope"]);
const options = new Map();
for (let index = 0; index < args.length; index += 2) {
  if (!allowed.has(args[index]) || args[index + 1] === undefined) {
    throw new Error("Usage: npm run query:capabilities -- [--specs <slug,slug>] [--action <action>] [--scope <scope>]");
  }
  options.set(args[index], args[index + 1]);
}
const specs = (options.get("--specs") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
if (new Set(specs).size !== specs.length) throw new Error("spec slugs must be unique");
const report = queryCapabilities(await loadSpecCapabilities(root), {
  specs,
  action: options.get("--action"),
  scope: options.get("--scope")
});
const coverage = await loadSpecCapabilityCoverage(root);
console.log(JSON.stringify({
  ...report,
  catalog: coverage ? {
    recordId: coverage.id,
    isComplete: coverage.isComplete,
    coveredSpecCount: coverage.entries.length,
    missingDataMeaning: coverage.missingDataMeaning
  } : null
}, null, 2));
