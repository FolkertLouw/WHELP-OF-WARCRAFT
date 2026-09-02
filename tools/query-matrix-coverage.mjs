import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadSpecCapabilities, loadSpecDungeonMatrices } from "./lib/load-query-data.mjs";
import { queryMatrixCoverage } from "./lib/matrix-coverage-query.mjs";

const root = path.resolve(import.meta.dirname, "..");
if (process.argv.length > 2) throw new Error("Usage: npm run query:matrix-coverage");
const season = JSON.parse(await readFile(path.join(root, "data", "seasons", "midnight-season-2.json"), "utf8"));
console.log(JSON.stringify(queryMatrixCoverage(
  await loadSpecCapabilities(root),
  await loadSpecDungeonMatrices(root),
  season,
), null, 2));
