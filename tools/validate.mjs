import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const failures = [];
const records = [];
const recordIds = new Map();

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
  } else if (value.recordType === "season") {
    requireFields(file, value, ["id", "status", "expansion", "seasonNumber", "validity", "dungeons", "provenance"]);
    const mapIds = (value.dungeons ?? []).map((dungeon) => dungeon.challengeMapId);
    if (new Set(mapIds).size !== mapIds.length) fail(file, "season challengeMapId values must be unique");
  } else if (value.recordType === "dungeon") {
    requireFields(file, value, ["id", "status", "name", "validity", "challengeMapId", "instanceMapId", "encounters", "enemies", "provenance"]);
    const npcIds = (value.enemies ?? []).map((enemy) => enemy.npcId);
    for (const encounter of value.encounters ?? []) {
      if (!npcIds.includes(encounter.npcId)) fail(file, `encounter NPC ${encounter.npcId} is absent from enemies`);
    }
  } else if (value.recordType === "mechanic") {
    requireFields(file, value, ["id", "status", "validity", "encounter", "mechanic", "provenance"]);
    if (!value.mechanic?.spellId) fail(file, "mechanic.spellId must be a positive numeric ID");
  } else if (value.recordType === "enemy-abilities") {
    requireFields(file, value, ["id", "status", "validity", "instanceMapId", "enemies", "provenance"]);
    for (const enemy of value.enemies ?? []) {
      const spellIds = (enemy.abilities ?? []).map((ability) => ability.spellId);
      if (new Set(spellIds).size !== spellIds.length) fail(file, `duplicate ability for NPC ${enemy.npcId}`);
    }
  } else if (value.recordType === "spec-note") {
    requireFields(file, value, ["id", "status", "validity", "context", "specIds", "summary", "recommendations", "provenance"]);
  } else if (value.recordType === "strategy-note") {
    requireFields(file, value, ["id", "status", "validity", "context", "category", "summary", "actions", "provenance"]);
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

  if (value.id) {
    if (recordIds.has(value.id)) fail(file, `duplicate record id also used by ${recordIds.get(value.id)}`);
    recordIds.set(value.id, path.relative(root, file));
  }
  records.push({ file, value });
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
  if (value.$schema?.startsWith(".")) {
    const schemaPath = path.resolve(path.dirname(file), value.$schema);
    try {
      if (!(await stat(schemaPath)).isFile()) fail(file, `missing referenced schema ${value.$schema}`);
    } catch {
      fail(file, `missing referenced schema ${value.$schema}`);
    }
  }
  const isDataRecord = !file.includes(`${path.sep}schemas${path.sep}`)
    && path.basename(file) !== "package.json"
    && path.basename(file) !== "index.json";
  if (isDataRecord) validateRecord(file, value);
}

const dungeons = records.filter(({ value }) => value.recordType === "dungeon");
for (const { file, value } of records.filter(({ value }) => value.recordType === "mechanic")) {
  if (file.includes(`${path.sep}examples${path.sep}`)) continue;
  const dungeon = dungeons.find(({ value: candidate }) => candidate.instanceMapId === value.encounter?.instanceId);
  if (!dungeon) {
    fail(file, `no dungeon has instanceMapId ${value.encounter?.instanceId}`);
    continue;
  }
  const encounter = dungeon.value.encounters.find((candidate) => candidate.encounterId === value.encounter.encounterId);
  if (!encounter) fail(file, `unknown encounterId ${value.encounter.encounterId} for ${dungeon.value.id}`);
  else if (encounter.npcId !== value.encounter.npcId) fail(file, "mechanic NPC does not match its encounter");
}
for (const { file, value } of records.filter(({ value }) => value.recordType === "enemy-abilities")) {
  const dungeon = dungeons.find(({ value: candidate }) => candidate.instanceMapId === value.instanceMapId);
  if (!dungeon) {
    fail(file, `no dungeon has instanceMapId ${value.instanceMapId}`);
    continue;
  }
  const knownNpcIds = new Set(dungeon.value.enemies.map((enemy) => enemy.npcId));
  for (const enemy of value.enemies ?? []) {
    if (!knownNpcIds.has(enemy.npcId)) fail(file, `unknown NPC ${enemy.npcId} for ${dungeon.value.id}`);
  }
}
for (const { file, value } of records.filter(({ value }) => ["spec-note", "strategy-note"].includes(value.recordType))) {
  if (file.includes(`${path.sep}examples${path.sep}`)) continue;
  const instanceMapId = value.context?.instanceMapId;
  if (!instanceMapId) continue;
  const dungeon = dungeons.find(({ value: candidate }) => candidate.instanceMapId === instanceMapId);
  if (!dungeon) fail(file, `no dungeon has instanceMapId ${instanceMapId}`);
  if (value.recordType === "strategy-note" && dungeon) {
    const knownNpcIds = new Set(dungeon.value.enemies.map((enemy) => enemy.npcId));
    for (const npcId of value.context.npcIds ?? []) {
      if (!knownNpcIds.has(npcId)) fail(file, `unknown NPC ${npcId} for ${dungeon.value.id}`);
    }
  }
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

const contentIndexPath = path.join(root, "content", "index.json");
const contentIndex = JSON.parse(await readFile(contentIndexPath, "utf8"));
const indexedContentIds = new Set();
for (const entry of contentIndex.records ?? []) {
  if (indexedContentIds.has(entry.id)) fail(contentIndexPath, `duplicate content id ${entry.id}`);
  indexedContentIds.add(entry.id);
  const recordPath = path.join(root, "content", entry.path);
  try {
    const record = JSON.parse(await readFile(recordPath, "utf8"));
    if (record.id !== entry.id) fail(contentIndexPath, `${entry.path} has id ${record.id}, expected ${entry.id}`);
    if (record.status !== entry.status) fail(contentIndexPath, `${entry.path} has status ${record.status}, expected ${entry.status}`);
  } catch (error) {
    fail(contentIndexPath, `cannot read indexed record ${entry.path}: ${error.message}`);
  }
}
for (const { file, value } of records.filter(({ file }) => file.startsWith(path.join(root, "content")))) {
  if (path.basename(file) === "index.json" || !value.id) continue;
  if (!indexedContentIds.has(value.id)) fail(file, `content record ${value.id} is absent from content/index.json`);
}

if (failures.length) {
  console.error(`WHELP validation failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`WHELP validation passed (${files.filter((file) => file.endsWith(".json")).length} JSON files checked)`);
