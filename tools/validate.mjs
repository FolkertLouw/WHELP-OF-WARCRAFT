import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const failures = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    files.push(...(entry.isDirectory() ? await walk(target) : [target]));
  }
  return files;
}

function fail(file, message) {
  failures.push(`${path.relative(root, file)}: ${message}`);
}

function requireFields(file, value, fields) {
  for (const field of fields) {
    if (value[field] === undefined || value[field] === null) fail(file, `missing ${field}`);
  }
}

function validateRecord(file, value) {
  if (!value.recordType) return;
  requireFields(file, value, ["schemaVersion", "recordType"]);
  if (value.schemaVersion !== 1) fail(file, "unsupported schemaVersion");

  if (value.recordType === "build-manifest") {
    requireFields(file, value, ["product", "version", "interfaceVersion", "observedAt", "provenance"]);
  } else if (value.recordType === "mechanic") {
    requireFields(file, value, ["id", "status", "validity", "encounter", "mechanic", "provenance"]);
    if (!value.mechanic?.spellId) fail(file, "mechanic.spellId must be a positive numeric ID");
  } else if (value.recordType === "route") {
    requireFields(file, value, ["id", "status", "validity", "challengeMapId", "pulls", "provenance"]);
    const orders = (value.pulls ?? []).map((pull) => pull.order);
    if (new Set(orders).size !== orders.length) fail(file, "pull order values must be unique");
  } else if (value.recordType === "run-observation") {
    requireFields(file, value, ["collector", "game", "run", "player", "group", "privacy"]);
    if (value.privacy?.containsNames !== false || value.privacy?.containsChat !== false) {
      fail(file, "public observations must explicitly exclude names and chat");
    }
  } else {
    fail(file, `unknown recordType ${value.recordType}`);
  }
}

const files = await walk(root);
for (const file of files.filter((candidate) => candidate.endsWith(".json"))) {
  let value;
  try {
    value = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    fail(file, `invalid JSON: ${error.message}`);
    continue;
  }
  const isDataRecord = !file.includes(`${path.sep}schemas${path.sep}`)
    && path.basename(file) !== "package.json"
    && path.basename(file) !== "index.json";
  if (isDataRecord) validateRecord(file, value);
}

const indexPath = path.join(root, "data", "index.json");
const index = JSON.parse(await readFile(indexPath, "utf8"));
for (const build of index.builds ?? []) {
  const manifestPath = path.join(root, "data", build.manifest);
  try {
    if (!(await stat(manifestPath)).isFile()) fail(indexPath, `missing manifest ${build.manifest}`);
  } catch {
    fail(indexPath, `missing manifest ${build.manifest}`);
  }
}

if (failures.length) {
  console.error(`WHELP validation failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`WHELP validation passed (${files.filter((file) => file.endsWith(".json")).length} JSON files checked)`);
