import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { compareRunToRoute } from "./lib/route-comparison.mjs";

function usage() {
  console.error("Usage: npm run compare:route -- --route <route.json> --observation <run-observation.json>");
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const routePath = argument("--route");
const observationPath = argument("--observation");
if (!routePath || !observationPath) {
  usage();
  process.exit(2);
}

try {
  const [route, observation] = await Promise.all([
    readFile(path.resolve(routePath), "utf8").then(JSON.parse),
    readFile(path.resolve(observationPath), "utf8").then(JSON.parse),
  ]);
  console.log(JSON.stringify(compareRunToRoute(route, observation), null, 2));
} catch (error) {
  console.error(`Cannot compare route and observation: ${error.message}`);
  process.exit(1);
}
