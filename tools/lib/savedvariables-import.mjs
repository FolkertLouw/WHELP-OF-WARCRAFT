import { createHash } from "node:crypto";
import luaparse from "luaparse";

const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
const MAX_TABLE_FIELDS = 10000;
const MAX_DEPTH = 32;
const SAFE_ID = /^[a-z0-9][a-z0-9./_-]+$/;
const SAFE_TEXT = /^[\x20-\x7e]+$/;
const VERSION = /^\d+\.\d+\.\d+(?:[.-][0-9A-Za-z.-]+)?$/;

class ImportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ImportError";
    this.code = code;
  }
}

function reject(code, message) {
  throw new ImportError(code, message);
}

function decodeLiteral(node, depth = 0) {
  if (depth > MAX_DEPTH) reject("lua-depth-limit", "SavedVariables table nesting is too deep");
  if (["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(node?.type)) return node.value;
  if (node?.type === "NilLiteral") return null;
  if (node?.type !== "TableConstructorExpression") {
    reject("unsafe-lua-expression", `Unsupported Lua expression ${node?.type ?? "unknown"}`);
  }
  if (node.fields.length > MAX_TABLE_FIELDS) reject("lua-table-limit", "SavedVariables table contains too many fields");

  const named = new Map();
  const indexed = new Map();
  let nextArrayIndex = 1;
  for (const field of node.fields) {
    let key;
    if (field.type === "TableKeyString") key = field.key.name;
    else if (field.type === "TableKey") key = decodeLiteral(field.key, depth + 1);
    else if (field.type === "TableValue") key = nextArrayIndex;
    else reject("unsafe-lua-field", `Unsupported Lua table field ${field.type}`);

    const value = decodeLiteral(field.value, depth + 1);
    if (typeof key === "number") {
      if (!Number.isSafeInteger(key) || key < 1 || key > MAX_TABLE_FIELDS) {
        reject("invalid-lua-index", "Lua table indices must be bounded positive integers");
      }
      if (indexed.has(key)) reject("duplicate-lua-key", "Lua table contains a duplicate numeric key");
      indexed.set(key, value);
      nextArrayIndex = Math.max(nextArrayIndex, key + 1);
    } else if (typeof key === "string") {
      if (["__proto__", "constructor", "prototype"].includes(key)) reject("unsafe-lua-key", "Lua table contains a prohibited key");
      if (named.has(key)) reject("duplicate-lua-key", "Lua table contains a duplicate named key");
      named.set(key, value);
    } else {
      reject("invalid-lua-key", "Lua table keys must be strings or positive integers");
    }
  }

  if (named.size && indexed.size) reject("mixed-lua-table", "Mixed keyed and indexed Lua tables are not accepted");
  if (named.size) return Object.fromEntries(named);
  if (!indexed.size) return [];
  const maximum = Math.max(...indexed.keys());
  for (let index = 1; index <= maximum; index += 1) {
    if (!indexed.has(index)) reject("sparse-lua-array", "Sparse Lua arrays are not accepted");
  }
  return Array.from({ length: maximum }, (_, index) => indexed.get(index + 1));
}

export function parseWhelpSavedVariables(source) {
  if (typeof source !== "string") reject("invalid-source", "SavedVariables input must be text");
  if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) reject("source-size-limit", "SavedVariables input exceeds 16 MiB");
  let ast;
  try {
    ast = luaparse.parse(source.replace(/^\uFEFF/, ""), {
      luaVersion: "5.1",
      encodingMode: "pseudo-latin1",
      comments: false,
    });
  } catch (error) {
    reject("invalid-lua", `Cannot parse SavedVariables: ${error.message}`);
  }
  if (ast.body.length !== 1 || ast.body[0].type !== "AssignmentStatement") {
    reject("unsafe-lua-program", "Expected exactly one SavedVariables assignment");
  }
  const statement = ast.body[0];
  if (statement.variables.length !== 1 || statement.init.length !== 1
    || statement.variables[0].type !== "Identifier"
    || statement.variables[0].name !== "WHELPCollectorDB") {
    reject("wrong-saved-variable", "Expected an assignment to WHELPCollectorDB");
  }
  const decoded = decodeLiteral(statement.init[0]);
  if (!decoded || Array.isArray(decoded) || typeof decoded !== "object") {
    reject("invalid-database", "WHELPCollectorDB must be a keyed table");
  }
  return decoded;
}

function object(value, path) {
  if (!value || Array.isArray(value) || typeof value !== "object") reject("invalid-record", `${path} must be an object`);
  return value;
}

function array(value, path, maximum) {
  if (!Array.isArray(value)) reject("invalid-record", `${path} must be an array`);
  if (value.length > maximum) reject("record-limit", `${path} exceeds its item limit`);
  return value;
}

function integer(value, path, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER, nullable = false, optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (value === null && nullable) return null;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) reject("invalid-record", `${path} must be an integer in range`);
  return value;
}

function number(value, path, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER, nullable = false, optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (value === null && nullable) return null;
  if (!Number.isFinite(value) || value < minimum || value > maximum) reject("invalid-record", `${path} must be a finite number in range`);
  return value;
}

function string(value, path, { pattern = SAFE_TEXT, maximum = 128, nullable = false, optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (value === null && nullable) return null;
  if (typeof value !== "string" || value.length < 1 || value.length > maximum || !pattern.test(value)) {
    reject("invalid-record", `${path} must be safe bounded text`);
  }
  return value;
}

function enumeration(value, allowed, path) {
  if (!allowed.includes(value)) reject("invalid-record", `${path} has an unsupported value`);
  return value;
}

function dropUnknown(value, allowed, audit) {
  audit.strippedFieldCount += Object.keys(value).filter((key) => !allowed.includes(key)).length;
}

function optionalProperty(target, key, value) {
  if (value !== undefined) target[key] = value;
}

function sanitizePlayer(input, path, audit) {
  input = object(input, path);
  dropUnknown(input, ["classId", "specId", "role", "itemLevel"], audit);
  const result = {
    classId: integer(input.classId, `${path}.classId`, { minimum: 1, maximum: 100 }),
    specId: integer(input.specId, `${path}.specId`, { minimum: 1, maximum: 10000, nullable: true, optional: true }) ?? null,
    role: enumeration(input.role, ["TANK", "HEALER", "DAMAGER", "NONE"], `${path}.role`),
  };
  optionalProperty(result, "itemLevel", number(input.itemLevel, `${path}.itemLevel`, { maximum: 10000, nullable: true, optional: true }));
  return result;
}

export function sanitizeRun(input, audit = { strippedFieldCount: 0 }) {
  input = object(input, "run");
  dropUnknown(input, ["schemaVersion", "recordType", "collector", "game", "run", "encounters", "pulls", "player", "group", "privacy"], audit);
  if (input.schemaVersion !== 1 || input.recordType !== "run-observation") reject("unsupported-observation", "Unsupported observation record version or type");

  const collector = object(input.collector, "collector");
  dropUnknown(collector, ["name", "version", "knowledgeBuild", "knowledgeRevision"], audit);
  if (collector.name !== "WHELP Collector") reject("unknown-collector", "Observation was not produced by WHELP Collector");

  const game = object(input.game, "game");
  dropUnknown(game, ["version", "build", "interfaceVersion", "region"], audit);
  const sanitizedGame = {
    version: string(game.version, "game.version", { pattern: VERSION, maximum: 32 }),
    build: string(game.build, "game.build", { pattern: /^\d{4,12}$/, maximum: 12 }),
    interfaceVersion: integer(game.interfaceVersion, "game.interfaceVersion", { minimum: 1, maximum: 9999999 }),
  };
  optionalProperty(sanitizedGame, "region", string(game.region, "game.region", { pattern: /^[A-Z]{2,4}$/, maximum: 4, nullable: true, optional: true }));

  const run = object(input.run, "run");
  dropUnknown(run, ["challengeMapId", "routePlanId", "keystoneLevel", "affixIds", "startedAt", "completedAt", "durationMs", "deathCount", "deathTimeLostMs", "recoveryCount", "telemetryGapCount", "lastRecoveredAt", "pullDataStatus", "terminationReason", "status"], audit);
  const affixIds = array(run.affixIds ?? [], "run.affixIds", 16).map((id, index) => integer(id, `run.affixIds[${index}]`, { minimum: 1, maximum: 100000 }));
  if (new Set(affixIds).size !== affixIds.length) reject("invalid-record", "run.affixIds contains duplicates");
  const sanitizedRun = {
    challengeMapId: integer(run.challengeMapId, "run.challengeMapId", { minimum: 1, maximum: 10000000 }),
    keystoneLevel: integer(run.keystoneLevel, "run.keystoneLevel", { minimum: 2, maximum: 1000 }),
    affixIds,
    startedAt: integer(run.startedAt, "run.startedAt", { minimum: 1 }),
    deathCount: integer(run.deathCount ?? 0, "run.deathCount", { maximum: 100000 }),
    deathTimeLostMs: integer(run.deathTimeLostMs ?? 0, "run.deathTimeLostMs", { maximum: 864000000 }),
    recoveryCount: integer(run.recoveryCount ?? 0, "run.recoveryCount", { maximum: 10000 }),
    telemetryGapCount: integer(run.telemetryGapCount ?? 0, "run.telemetryGapCount", { maximum: 10000 }),
    status: enumeration(run.status, ["started", "completed", "abandoned"], "run.status"),
  };
  optionalProperty(sanitizedRun, "routePlanId", string(run.routePlanId, "run.routePlanId", { pattern: SAFE_ID, maximum: 256, nullable: true, optional: true }));
  optionalProperty(sanitizedRun, "pullDataStatus", run.pullDataStatus === undefined ? undefined : enumeration(run.pullDataStatus, ["progress-only", "build-mismatch", "dungeon-unknown", "knowledge-unavailable"], "run.pullDataStatus"));
  optionalProperty(sanitizedRun, "completedAt", integer(run.completedAt, "run.completedAt", { minimum: 1, nullable: true, optional: true }));
  optionalProperty(sanitizedRun, "durationMs", integer(run.durationMs, "run.durationMs", { maximum: 864000000, nullable: true, optional: true }));
  optionalProperty(sanitizedRun, "lastRecoveredAt", integer(run.lastRecoveredAt, "run.lastRecoveredAt", { minimum: 1, nullable: true, optional: true }));
  optionalProperty(sanitizedRun, "terminationReason", run.terminationReason === undefined ? undefined : enumeration(run.terminationReason, ["challenge-completed", "challenge-reset", "superseded-by-new-run", "recovery-no-matching-challenge"], "run.terminationReason"));

  const encounters = array(input.encounters, "encounters", 100).map((candidate, index) => {
    const encounter = object(candidate, `encounters[${index}]`);
    dropUnknown(encounter, ["encounterId", "startedAt", "completedAt", "durationMs", "success"], audit);
    return {
      encounterId: integer(encounter.encounterId, `encounters[${index}].encounterId`, { minimum: 1, maximum: 10000000 }),
      startedAt: integer(encounter.startedAt, `encounters[${index}].startedAt`, { minimum: 1 }),
      completedAt: integer(encounter.completedAt, `encounters[${index}].completedAt`, { minimum: 1 }),
      durationMs: integer(encounter.durationMs, `encounters[${index}].durationMs`, { maximum: 864000000 }),
      success: enumeration(encounter.success, [true, false], `encounters[${index}].success`),
    };
  });

  let pulls;
  if (input.pulls !== undefined) {
    pulls = array(input.pulls, "pulls", 1000).map((candidate, index) => {
      const pull = object(candidate, `pulls[${index}]`);
      dropUnknown(pull, ["order", "plannedPullId", "startedAt", "completedAt", "durationMs", "enemies", "enemyForces", "enemyForcesSource", "enemyForcesStart", "enemyForcesEnd", "enemyIdentityStatus", "endReason", "deaths"], audit);
      const enemies = array(pull.enemies, `pulls[${index}].enemies`, 100).map((candidateEnemy, enemyIndex) => {
        const enemy = object(candidateEnemy, `pulls[${index}].enemies[${enemyIndex}]`);
        dropUnknown(enemy, ["npcId", "count"], audit);
        return {
          npcId: integer(enemy.npcId, `pulls[${index}].enemies[${enemyIndex}].npcId`, { minimum: 1, maximum: 10000000 }),
          count: integer(enemy.count, `pulls[${index}].enemies[${enemyIndex}].count`, { minimum: 1, maximum: 10000 }),
        };
      });
      const sanitizedPull = {
        order: integer(pull.order, `pulls[${index}].order`, { minimum: 1, maximum: 1000 }),
        startedAt: integer(pull.startedAt, `pulls[${index}].startedAt`, { minimum: 1 }),
        completedAt: integer(pull.completedAt, `pulls[${index}].completedAt`, { minimum: 1, nullable: true }),
        durationMs: integer(pull.durationMs, `pulls[${index}].durationMs`, { maximum: 864000000, nullable: true }),
        enemies,
        enemyForces: integer(pull.enemyForces, `pulls[${index}].enemyForces`, { maximum: 1000000 }),
        deaths: integer(pull.deaths, `pulls[${index}].deaths`, { maximum: 100000 }),
      };
      optionalProperty(sanitizedPull, "plannedPullId", string(pull.plannedPullId, `pulls[${index}].plannedPullId`, { pattern: /^[a-z0-9][a-z0-9-]+$/, maximum: 128, nullable: true, optional: true }));
      optionalProperty(sanitizedPull, "enemyForcesSource", pull.enemyForcesSource === undefined ? undefined : enumeration(pull.enemyForcesSource, ["scenario-progress", "canonical-npc-sum", "unavailable"], `pulls[${index}].enemyForcesSource`));
      optionalProperty(sanitizedPull, "enemyForcesStart", integer(pull.enemyForcesStart, `pulls[${index}].enemyForcesStart`, { maximum: 1000000, nullable: true, optional: true }));
      optionalProperty(sanitizedPull, "enemyForcesEnd", integer(pull.enemyForcesEnd, `pulls[${index}].enemyForcesEnd`, { maximum: 1000000, nullable: true, optional: true }));
      optionalProperty(sanitizedPull, "enemyIdentityStatus", pull.enemyIdentityStatus === undefined ? undefined : enumeration(pull.enemyIdentityStatus, ["available", "unavailable-secret-values"], `pulls[${index}].enemyIdentityStatus`));
      optionalProperty(sanitizedPull, "endReason", pull.endReason === undefined ? undefined : enumeration(pull.endReason, ["combat-ended", "reload-reconciled", "run-ended"], `pulls[${index}].endReason`));
      return sanitizedPull;
    });
  }

  const privacy = object(input.privacy, "privacy");
  dropUnknown(privacy, ["containsNames", "containsChat"], audit);
  if (privacy.containsNames !== false || privacy.containsChat !== false) reject("privacy-flag", "Observation does not explicitly exclude names and chat");

  const group = array(input.group, "group", 5).map((member, index) => sanitizePlayer(member, `group[${index}]`, audit));
  const result = {
    $schema: "https://whelp.dev/schemas/run-observation.schema.json",
    schemaVersion: 1,
    recordType: "run-observation",
    collector: { name: "WHELP Collector", version: string(collector.version, "collector.version", { pattern: VERSION, maximum: 32 }) },
    game: sanitizedGame,
    run: sanitizedRun,
    encounters,
    player: sanitizePlayer(input.player, "player", audit),
    group,
    privacy: { containsNames: false, containsChat: false },
  };
  optionalProperty(result.collector, "knowledgeBuild", string(collector.knowledgeBuild, "collector.knowledgeBuild", { pattern: /^\d+\.\d+\.\d+\.\d+$/, maximum: 48, nullable: true, optional: true }));
  optionalProperty(result.collector, "knowledgeRevision", string(collector.knowledgeRevision, "collector.knowledgeRevision", { pattern: /^[a-f0-9]{64}$/, maximum: 64, nullable: true, optional: true }));
  if (pulls !== undefined) result.pulls = pulls;
  validateObservationConsistency(result);
  return result;
}

function validateObservationConsistency(observation) {
  const { run } = observation;
  if (run.pullDataStatus === "progress-only"
    && observation.collector.knowledgeBuild !== `${observation.game.version}.${observation.game.build}`) {
    reject("inconsistent-knowledge-build", "Progress telemetry requires knowledge matching the observed game build");
  }
  if (run.pullDataStatus === "progress-only" && !/^[a-f0-9]{64}$/.test(observation.collector.knowledgeRevision ?? "")) {
    reject("inconsistent-knowledge-build", "Progress telemetry requires a generated knowledge revision");
  }
  const finished = ["completed", "abandoned"].includes(run.status);
  if (finished && (!Number.isInteger(run.completedAt) || !Number.isInteger(run.durationMs))) reject("inconsistent-time", "Finished run is missing completion timing");
  if (!finished && (run.completedAt != null || run.durationMs != null)) reject("inconsistent-time", "Started run contains completion timing");
  if (finished && (run.completedAt < run.startedAt || run.durationMs !== (run.completedAt - run.startedAt) * 1000)) {
    reject("inconsistent-time", "Run duration does not match its timestamps");
  }
  if (run.lastRecoveredAt != null && (run.lastRecoveredAt < run.startedAt || (finished && run.lastRecoveredAt > run.completedAt))) {
    reject("inconsistent-time", "Run recovery timestamp falls outside the run");
  }
  if ((run.recoveryCount === 0) !== (run.lastRecoveredAt == null)) {
    reject("inconsistent-recovery", "Run recovery count and timestamp disagree");
  }
  let deaths = 0;
  for (const [index, pull] of (observation.pulls ?? []).entries()) {
    if (pull.order !== index + 1) reject("inconsistent-pulls", "Observed pulls are not in contiguous order");
    if (pull.startedAt < run.startedAt || (finished && pull.startedAt > run.completedAt)) reject("inconsistent-time", "Pull timing falls outside the run");
    if (pull.completedAt === null ? pull.durationMs !== null : pull.durationMs !== (pull.completedAt - pull.startedAt) * 1000) {
      reject("inconsistent-time", "Pull duration does not match its timestamps");
    }
    if (finished && pull.completedAt !== null && pull.completedAt > run.completedAt) reject("inconsistent-time", "Pull timing falls outside the run");
    if (pull.enemyForcesSource === "scenario-progress") {
      if (!Number.isInteger(pull.enemyForcesStart) || !Number.isInteger(pull.enemyForcesEnd)
        || pull.enemyForcesEnd < pull.enemyForcesStart
        || pull.enemyForces !== pull.enemyForcesEnd - pull.enemyForcesStart) {
        reject("inconsistent-forces", "Scenario progress does not match the pull enemy-forces delta");
      }
      if (pull.enemyIdentityStatus !== "unavailable-secret-values" || pull.enemies.length !== 0) {
        reject("inconsistent-forces", "Scenario-only pull must not claim enemy identities");
      }
    } else if (pull.enemyForcesSource === "unavailable" && (pull.enemyForces !== 0 || pull.enemyForcesStart != null || pull.enemyForcesEnd != null)) {
      reject("inconsistent-forces", "Unavailable enemy forces must use zero with null progress snapshots");
    }
    deaths += pull.deaths;
  }
  if (deaths > run.deathCount) reject("inconsistent-deaths", "Pull deaths exceed the run death count");
  const plannedIds = (observation.pulls ?? []).map((pull) => pull.plannedPullId).filter(Boolean);
  if (plannedIds.length && !run.routePlanId) reject("inconsistent-route-link", "Planned pull IDs require a route plan ID");
  if (new Set(plannedIds).size !== plannedIds.length) reject("inconsistent-route-link", "Planned pull IDs must be unique");
  for (const encounter of observation.encounters) {
    if (encounter.startedAt < run.startedAt || encounter.completedAt < encounter.startedAt
      || encounter.durationMs !== (encounter.completedAt - encounter.startedAt) * 1000
      || (finished && encounter.completedAt > run.completedAt)) {
      reject("inconsistent-time", "Encounter timing is inconsistent with the run");
    }
  }
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashSanitizedObservation(observation) {
  return createHash("sha256").update(canonicalJson(observation)).digest("hex");
}

export function importWhelpSavedVariables(source) {
  const database = parseWhelpSavedVariables(source);
  const rootAudit = { strippedFieldCount: 0 };
  dropUnknown(database, ["schemaVersion", "collectorVersion", "runs", "settings", "activeRun", "activeEncounter"], rootAudit);
  if (database.schemaVersion !== 1) reject("unsupported-database", "Unsupported WHELPCollectorDB schema version");
  const runs = array(database.runs, "WHELPCollectorDB.runs", 2500);
  const exported = [];
  const rejections = [];
  const duplicates = [];
  const hashes = new Map();
  let strippedFieldCount = rootAudit.strippedFieldCount;

  for (const [index, rawRun] of runs.entries()) {
    const audit = { strippedFieldCount: 0 };
    try {
      const observation = sanitizeRun(rawRun, audit);
      strippedFieldCount += audit.strippedFieldCount;
      const sha256 = hashSanitizedObservation(observation);
      if (hashes.has(sha256)) {
        duplicates.push({ index: index + 1, duplicateOf: hashes.get(sha256), sha256 });
      } else {
        hashes.set(sha256, index + 1);
        exported.push({ sourceIndex: index + 1, sha256, observation });
      }
    } catch (error) {
      if (!(error instanceof ImportError)) throw error;
      rejections.push({ index: index + 1, code: error.code });
    }
  }

  return {
    $schema: "https://whelp.dev/schemas/sanitized-observation-bundle.schema.json",
    schemaVersion: 1,
    recordType: "sanitized-observation-bundle",
    bundleVersion: 1,
    bundleType: "sanitized-run-observations",
    source: {
      databaseSchemaVersion: database.schemaVersion,
      collectorVersion: typeof database.collectorVersion === "string" && VERSION.test(database.collectorVersion)
        ? database.collectorVersion.slice(0, 32)
        : null,
    },
    audit: {
      inputRunCount: runs.length,
      exportedRunCount: exported.length,
      rejectedRunCount: rejections.length,
      duplicateRunCount: duplicates.length,
      strippedFieldCount,
      activeRunExcluded: database.activeRun != null,
    },
    runs: exported,
    rejections,
    duplicates,
  };
}
