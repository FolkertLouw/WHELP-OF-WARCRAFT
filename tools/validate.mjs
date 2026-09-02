import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { hashSanitizedObservation } from "./lib/savedvariables-import.mjs";

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
    if (new Set(npcIds).size !== npcIds.length) fail(file, "dungeon enemy NPC IDs must be unique");
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
  } else if (value.recordType === "ability-index") {
    requireFields(file, value, ["id", "status", "validity", "seasonSlug", "abilityRowCount", "abilities", "provenance"]);
    const spellIds = (value.abilities ?? []).map((ability) => ability.spellId);
    if (new Set(spellIds).size !== spellIds.length) fail(file, "ability index spell IDs must be unique");
    for (const ability of value.abilities ?? []) {
      if (!ability.name?.trim()) fail(file, `indexed spell ${ability.spellId} is unnamed`);
      if (!(ability.responseTags ?? []).length) fail(file, `indexed spell ${ability.spellId} has no response tags`);
      const contexts = (ability.contexts ?? []).map((context) => `${context.dungeonId}:${context.npcId}`);
      if (new Set(contexts).size !== contexts.length) fail(file, `indexed spell ${ability.spellId} has duplicate NPC contexts`);
    }
  } else if (value.recordType === "ability-response") {
    requireFields(file, value, ["id", "status", "validity", "dungeonId", "instanceMapId", "entries", "provenance"]);
    const spellIds = (value.entries ?? []).map((entry) => entry.spellId);
    if (new Set(spellIds).size !== spellIds.length) fail(file, "ability response spell IDs must be unique");
    const allowedActions = new Set(["interrupt", "purge", "cleanse-magic", "cleanse-curse", "cleanse-disease", "cleanse-poison", "soothe", "defensive", "avoid", "line-of-sight", "crowd-control"]);
    for (const entry of value.entries ?? []) {
      requireFields(file, entry, ["spellId", "name", "npcIds", "targetDisposition", "actions", "priority", "evidenceStatus", "rationale"]);
      if (!(entry.actions ?? []).length) fail(file, `response spell ${entry.spellId} has no actions`);
      for (const action of entry.actions ?? []) {
        if (!allowedActions.has(action)) fail(file, `response spell ${entry.spellId} has unknown action ${action}`);
      }
    }
  } else if (value.recordType === "ability-response-index") {
    requireFields(file, value, ["id", "status", "validity", "seasonSlug", "entries", "provenance"]);
    const dungeonIds = (value.entries ?? []).map((entry) => entry.dungeonId);
    const recordIds = (value.entries ?? []).map((entry) => entry.recordId);
    if (new Set(dungeonIds).size !== dungeonIds.length) fail(file, "response index dungeon IDs must be unique");
    if (new Set(recordIds).size !== recordIds.length) fail(file, "response index record IDs must be unique");
  } else if (value.recordType === "spec-note") {
    requireFields(file, value, ["id", "status", "validity", "context", "specIds", "summary", "recommendations", "provenance"]);
  } else if (value.recordType === "spec-dungeon-matrix") {
    requireFields(file, value, ["id", "status", "validity", "spec", "axes", "dungeons", "affixes", "provenance"]);
    if (!Number.isInteger(value.spec?.classId) || value.spec.classId < 1) fail(file, "spec.classId must be a positive integer");
    if (!Number.isInteger(value.spec?.specId) || value.spec.specId < 1) fail(file, "spec.specId must be a positive integer");
    const axisIds = (value.axes ?? []).map((axis) => axis.id);
    if (new Set(axisIds).size !== axisIds.length) fail(file, "utility axis IDs must be unique");
    const dungeonIds = (value.dungeons ?? []).map((dungeon) => dungeon.dungeonId);
    if (new Set(dungeonIds).size !== dungeonIds.length) fail(file, "matrix dungeon IDs must be unique");
    const affixSlugs = (value.affixes ?? []).map((affix) => affix.affixSlug);
    if (new Set(affixSlugs).size !== affixSlugs.length) fail(file, "matrix affix slugs must be unique");
    for (const dungeon of value.dungeons ?? []) {
      const ratingIds = Object.keys(dungeon.ratings ?? {});
      for (const axisId of axisIds) {
        if (!ratingIds.includes(axisId)) fail(file, `${dungeon.dungeonId} is missing rating ${axisId}`);
      }
      for (const ratingId of ratingIds) {
        if (!axisIds.includes(ratingId)) fail(file, `${dungeon.dungeonId} rates unknown utility axis ${ratingId}`);
        if (!["always", "niche", "none"].includes(dungeon.ratings[ratingId])) {
          fail(file, `${dungeon.dungeonId} has invalid rating for ${ratingId}`);
        }
      }
    }
  } else if (value.recordType === "strategy-note") {
    requireFields(file, value, ["id", "status", "validity", "context", "category", "summary", "actions", "provenance"]);
  } else if (value.recordType === "affix-set") {
    requireFields(file, value, ["id", "status", "validity", "definitions", "activations", "provenance"]);
    const slugs = (value.definitions ?? []).map((definition) => definition.slug);
    if (new Set(slugs).size !== slugs.length) fail(file, "affix definition slugs must be unique");
    const known = new Set(slugs);
    for (const activation of value.activations ?? []) {
      if (!known.has(activation.reference)) fail(file, `activation references unknown affix ${activation.reference}`);
      if (activation.maximumKey !== null && activation.maximumKey < activation.minimumKey) {
        fail(file, `activation ${activation.reference} has maximumKey below minimumKey`);
      }
    }
  } else if (value.recordType === "route") {
    requireFields(file, value, ["id", "status", "validity", "dungeonId", "challengeMapId", "instanceMapId", "routeKind", "targetEnemyForces", "pulls", "provenance"]);
    const orders = (value.pulls ?? []).map((pull) => pull.order);
    if (new Set(orders).size !== orders.length) fail(file, "pull order values must be unique");
    const pullIds = (value.pulls ?? []).map((pull) => pull.id);
    if (new Set(pullIds).size !== pullIds.length) fail(file, "pull IDs must be unique");
    for (let index = 0; index < orders.length; index += 1) {
      if (orders[index] !== index + 1) fail(file, "pull order must be contiguous and match array order");
    }
  } else if (value.recordType === "route-catalog") {
    requireFields(file, value, ["id", "status", "validity", "seasonSlug", "scope", "entries", "provenance"]);
    if (value.scope?.maximumKey < value.scope?.minimumKey) fail(file, "scope.maximumKey is below scope.minimumKey");
    const dungeonIds = (value.entries ?? []).map((entry) => entry.dungeonId);
    const routeIds = (value.entries ?? []).map((entry) => entry.routeId);
    if (new Set(dungeonIds).size !== dungeonIds.length) fail(file, "catalog dungeon IDs must be unique");
    if (new Set(routeIds).size !== routeIds.length) fail(file, "catalog route IDs must be unique");
    for (const entry of value.entries ?? []) {
      if (!["not-flagged", "older", "unknown"].includes(entry.sourceMappingStatus)) {
        fail(file, `${entry.dungeonId} has invalid sourceMappingStatus`);
      }
      if (!["direct", "reconciled", "conflicted"].includes(entry.normalizationStatus)) {
        fail(file, `${entry.dungeonId} has invalid normalizationStatus`);
      }
    }
  } else if (value.recordType === "run-observation") {
    requireFields(file, value, ["collector", "game", "run", "player", "group", "privacy"]);
    if (value.privacy?.containsNames !== false || value.privacy?.containsChat !== false) {
      fail(file, "public observations must explicitly exclude names and chat");
    }
    const pulls = value.pulls ?? [];
    if (value.run?.pullDataStatus === "progress-only"
      && value.collector?.knowledgeBuild !== `${value.game?.version}.${value.game?.build}`) {
      fail(file, "progress telemetry knowledgeBuild must match the observed game build");
    }
    if (value.run?.pullDataStatus === "progress-only" && !/^[a-f0-9]{64}$/.test(value.collector?.knowledgeRevision ?? "")) {
      fail(file, "progress telemetry requires a generated knowledge revision");
    }
    const pullOrders = pulls.map((pull) => pull.order);
    if (new Set(pullOrders).size !== pullOrders.length) fail(file, "observed pull order values must be unique");
    for (let index = 0; index < pullOrders.length; index += 1) {
      if (pullOrders[index] !== index + 1) fail(file, "observed pull order must be contiguous and match array order");
    }
    const plannedPullIds = pulls.map((pull) => pull.plannedPullId).filter(Boolean);
    if (new Set(plannedPullIds).size !== plannedPullIds.length) fail(file, "plannedPullId values must be unique within an observation");
    if (plannedPullIds.length && !value.run?.routePlanId) fail(file, "plannedPullId requires run.routePlanId");
    const startedAt = value.run?.startedAt;
    const completedAt = value.run?.completedAt;
    if (completedAt !== null && completedAt !== undefined && completedAt < startedAt) fail(file, "run.completedAt is before run.startedAt");
    if (completedAt !== null && completedAt !== undefined && value.run?.durationMs !== (completedAt - startedAt) * 1000) {
      fail(file, "run.durationMs does not match run timestamps");
    }
    if ((completedAt === null || completedAt === undefined) && value.run?.durationMs !== null && value.run?.durationMs !== undefined) {
      fail(file, "run has durationMs without completedAt");
    }
    if (["completed", "abandoned"].includes(value.run?.status) && (completedAt === null || completedAt === undefined)) {
      fail(file, `${value.run.status} run is missing completedAt`);
    }
    if (value.run?.status === "started" && completedAt !== null && completedAt !== undefined) fail(file, "started run must not have completedAt");
    let attributedDeaths = 0;
    for (const pull of pulls) {
      attributedDeaths += pull.deaths ?? 0;
      if (pull.startedAt < startedAt) fail(file, `observed pull ${pull.order} starts before the run`);
      if (completedAt !== null && completedAt !== undefined && pull.startedAt > completedAt) fail(file, `observed pull ${pull.order} starts after the run`);
      if (pull.completedAt !== null && pull.completedAt !== undefined) {
        if (pull.completedAt < pull.startedAt) fail(file, `observed pull ${pull.order} completes before it starts`);
        if (pull.durationMs !== (pull.completedAt - pull.startedAt) * 1000) fail(file, `observed pull ${pull.order} duration does not match timestamps`);
        if (completedAt !== null && completedAt !== undefined && pull.completedAt > completedAt) fail(file, `observed pull ${pull.order} completes after the run`);
      } else if (pull.durationMs !== null) {
        fail(file, `observed pull ${pull.order} has durationMs without completedAt`);
      }
      if (pull.enemyForcesSource === "scenario-progress") {
        if (!Number.isInteger(pull.enemyForcesStart) || !Number.isInteger(pull.enemyForcesEnd)
          || pull.enemyForcesEnd < pull.enemyForcesStart
          || pull.enemyForces !== pull.enemyForcesEnd - pull.enemyForcesStart) {
          fail(file, `observed pull ${pull.order} scenario progress is inconsistent`);
        }
        if (pull.enemyIdentityStatus !== "unavailable-secret-values" || pull.enemies?.length !== 0) {
          fail(file, `observed pull ${pull.order} cannot claim enemy identities from scenario-only progress`);
        }
      } else if (pull.enemyForcesSource === "unavailable"
        && (pull.enemyForces !== 0 || pull.enemyForcesStart != null || pull.enemyForcesEnd != null)) {
        fail(file, `observed pull ${pull.order} unavailable progress fields are inconsistent`);
      }
    }
    if (attributedDeaths > (value.run?.deathCount ?? 0)) fail(file, "pull-attributed deaths exceed the run death count");
    for (const encounter of value.encounters ?? []) {
      if (encounter.startedAt < startedAt) fail(file, `encounter ${encounter.encounterId} starts before the run`);
      if (encounter.completedAt < encounter.startedAt) fail(file, `encounter ${encounter.encounterId} completes before it starts`);
      if (encounter.durationMs !== (encounter.completedAt - encounter.startedAt) * 1000) fail(file, `encounter ${encounter.encounterId} duration does not match timestamps`);
      if (completedAt !== null && completedAt !== undefined && encounter.completedAt > completedAt) fail(file, `encounter ${encounter.encounterId} completes after the run`);
    }
  } else if (value.recordType === "sanitized-observation-bundle") {
    requireFields(file, value, ["bundleVersion", "bundleType", "source", "audit", "runs", "rejections", "duplicates"]);
    if (value.bundleVersion !== 1 || value.bundleType !== "sanitized-run-observations") fail(file, "unsupported sanitized observation bundle");
    const audit = value.audit ?? {};
    const runs = value.runs ?? [];
    const rejections = value.rejections ?? [];
    const duplicates = value.duplicates ?? [];
    if (audit.exportedRunCount !== runs.length) fail(file, "bundle exportedRunCount does not match runs");
    if (audit.rejectedRunCount !== rejections.length) fail(file, "bundle rejectedRunCount does not match rejections");
    if (audit.duplicateRunCount !== duplicates.length) fail(file, "bundle duplicateRunCount does not match duplicates");
    if (audit.inputRunCount !== runs.length + rejections.length + duplicates.length) fail(file, "bundle audit counts do not partition the input");
    const usedIndices = [];
    const exportedByIndex = new Map();
    for (const entry of runs) {
      requireFields(file, entry, ["sourceIndex", "sha256", "observation"]);
      usedIndices.push(entry.sourceIndex);
      exportedByIndex.set(entry.sourceIndex, entry);
      if (hashSanitizedObservation(entry.observation) !== entry.sha256) fail(file, `bundle run ${entry.sourceIndex} has an incorrect payload hash`);
      validateRecord(file, entry.observation);
    }
    for (const rejection of rejections) usedIndices.push(rejection.index);
    for (const duplicate of duplicates) {
      usedIndices.push(duplicate.index);
      const original = exportedByIndex.get(duplicate.duplicateOf);
      if (!original || original.sha256 !== duplicate.sha256) fail(file, `bundle duplicate ${duplicate.index} does not resolve to its exported payload`);
      if (duplicate.duplicateOf >= duplicate.index) fail(file, `bundle duplicate ${duplicate.index} must reference an earlier input`);
    }
    if (new Set(usedIndices).size !== usedIndices.length) fail(file, "bundle source indices must be unique");
    for (let index = 1; index <= audit.inputRunCount; index += 1) {
      if (!usedIndices.includes(index)) fail(file, `bundle does not account for input run ${index}`);
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
  else if (value.encounter.npcId !== undefined && encounter.npcId !== value.encounter.npcId) fail(file, "mechanic NPC does not match its encounter");
  if (value.encounter.actorNpcId !== undefined) {
    const knownNpcIds = new Set(dungeon.value.enemies.map((enemy) => enemy.npcId));
    if (!knownNpcIds.has(value.encounter.actorNpcId)) fail(file, `unknown mechanic actor NPC ${value.encounter.actorNpcId} for ${dungeon.value.id}`);
  }
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
const indexedAbilities = new Map(
  records
    .filter(({ value }) => value.recordType === "ability-index")
    .flatMap(({ value }) => (value.abilities ?? []).map((ability) => [ability.spellId, ability])),
);
for (const { file, value } of records.filter(({ value }) => value.recordType === "ability-response")) {
  if (file.includes(`${path.sep}examples${path.sep}`)) continue;
  const dungeon = dungeons.find(({ value: candidate }) => candidate.id === value.dungeonId);
  if (!dungeon) {
    fail(file, `ability response references unknown dungeon ${value.dungeonId}`);
    continue;
  }
  if (dungeon.value.instanceMapId !== value.instanceMapId) {
    fail(file, `instanceMapId ${value.instanceMapId} does not match ${value.dungeonId}`);
  }
  const knownNpcIds = new Set(dungeon.value.enemies.map((enemy) => enemy.npcId));
  for (const entry of value.entries ?? []) {
    const indexed = indexedAbilities.get(entry.spellId);
    if (!indexed) {
      fail(file, `response spell ${entry.spellId} is absent from the ability index`);
      continue;
    }
    if (indexed.name !== entry.name) fail(file, `response spell ${entry.spellId} name does not match the ability index`);
    const indexedNpcIds = new Set(
      indexed.contexts
        .filter((context) => context.dungeonId === value.dungeonId)
        .map((context) => context.npcId),
    );
    for (const npcId of entry.npcIds ?? []) {
      if (!knownNpcIds.has(npcId)) fail(file, `response spell ${entry.spellId} references unknown NPC ${npcId}`);
      if (!indexedNpcIds.has(npcId)) fail(file, `response spell ${entry.spellId} is not indexed for NPC ${npcId}`);
    }
    const actions = new Set(entry.actions ?? []);
    if (entry.targetDisposition === "enemy-buff" && [...actions].some((action) => action.startsWith("cleanse-"))) {
      fail(file, `response spell ${entry.spellId} uses a friendly cleanse on an enemy buff`);
    }
    if (entry.targetDisposition === "player-debuff" && (actions.has("purge") || actions.has("soothe"))) {
      fail(file, `response spell ${entry.spellId} uses offensive removal on a player debuff`);
    }
    if (entry.targetDisposition === "positional" && actions.has("interrupt")) {
      fail(file, `response spell ${entry.spellId} turns a positional response into interrupt advice`);
    }
  }
}
const abilityResponsesById = new Map(
  records.filter(({ value }) => value.recordType === "ability-response").map(({ value }) => [value.id, value]),
);
for (const { file, value } of records.filter(({ value }) => value.recordType === "ability-response-index")) {
  if (value.validity?.seasonSlug !== value.seasonSlug) fail(file, "response index seasonSlug does not match validity");
  const indexedResponseIds = new Set((value.entries ?? []).map((entry) => entry.recordId));
  const scopedResponses = [...abilityResponsesById.values()].filter((response) => response.validity?.seasonSlug === value.seasonSlug);
  for (const response of scopedResponses) {
    if (!indexedResponseIds.has(response.id)) fail(file, `response index omits scoped record ${response.id}`);
  }
  for (const entry of value.entries ?? []) {
    const response = abilityResponsesById.get(entry.recordId);
    if (!response) {
      fail(file, `response index references unknown record ${entry.recordId}`);
      continue;
    }
    if (response.dungeonId !== entry.dungeonId) fail(file, `${entry.recordId} belongs to ${response.dungeonId}, not ${entry.dungeonId}`);
    if (response.status !== entry.status) fail(file, `${entry.recordId} status is stale`);
    const resolvedPath = path.resolve(path.dirname(file), entry.path);
    const responseFile = records.find(({ value: candidate }) => candidate.id === entry.recordId)?.file;
    if (resolvedPath !== responseFile) fail(file, `${entry.recordId} path does not resolve to its record`);
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
    if (value.context.encounterId !== null && value.context.encounterId !== undefined) {
      const knownEncounterIds = new Set(dungeon.value.encounters.map((encounter) => encounter.encounterId));
      if (!knownEncounterIds.has(value.context.encounterId)) {
        fail(file, `unknown encounterId ${value.context.encounterId} for ${dungeon.value.id}`);
      }
    }
  }
}
const affixDefinitions = new Set(
  records
    .filter(({ value }) => value.recordType === "affix-set")
    .flatMap(({ value }) => (value.definitions ?? []).map((definition) => definition.slug)),
);
for (const { file, value } of records.filter(({ value }) => value.recordType === "spec-dungeon-matrix")) {
  if (file.includes(`${path.sep}examples${path.sep}`)) continue;
  for (const entry of value.dungeons ?? []) {
    const dungeon = dungeons.find(({ value: candidate }) => candidate.id === entry.dungeonId);
    if (!dungeon) fail(file, `matrix references unknown dungeon ${entry.dungeonId}`);
    else if (dungeon.value.instanceMapId !== entry.instanceMapId) {
      fail(file, `${entry.dungeonId} instanceMapId ${entry.instanceMapId} does not match dungeon record ${dungeon.value.instanceMapId}`);
    }
  }
  for (const affix of value.affixes ?? []) {
    if (!affixDefinitions.has(affix.affixSlug)) fail(file, `matrix references unknown affix ${affix.affixSlug}`);
  }
}

const indexPath = path.join(root, "data", "index.json");
const index = JSON.parse(await readFile(indexPath, "utf8"));
for (const season of index.seasons ?? []) {
  const manifestPath = path.join(root, "data", season.manifest);
  try {
    const record = JSON.parse(await readFile(manifestPath, "utf8"));
    if (record.id !== season.id) fail(indexPath, `${season.manifest} has id ${record.id}, expected ${season.id}`);
    if (record.status !== season.status) fail(indexPath, `${season.manifest} has status ${record.status}, expected ${season.status}`);
  } catch (error) {
    fail(indexPath, `cannot read season ${season.manifest}: ${error.message}`);
  }
}
for (const dungeon of index.dungeons ?? []) {
  for (const field of ["record", "enemyAbilities"]) {
    const recordPath = path.join(root, "data", dungeon[field]);
    try {
      const record = JSON.parse(await readFile(recordPath, "utf8"));
      if (record.id !== (field === "record" ? dungeon.id : `${dungeon.id}/enemy-abilities`)) {
        fail(indexPath, `${dungeon[field]} has unexpected id ${record.id}`);
      }
      if (field === "record" && record.status !== dungeon.status) {
        fail(indexPath, `${dungeon[field]} has status ${record.status}, expected ${dungeon.status}`);
      }
    } catch (error) {
      fail(indexPath, `cannot read dungeon ${dungeon[field]}: ${error.message}`);
    }
  }
}
for (const affixSet of index.affixSets ?? []) {
  const recordPath = path.join(root, "data", affixSet.record);
  try {
    const record = JSON.parse(await readFile(recordPath, "utf8"));
    if (record.id !== affixSet.id) fail(indexPath, `${affixSet.record} has id ${record.id}, expected ${affixSet.id}`);
    if (record.status !== affixSet.status) fail(indexPath, `${affixSet.record} has status ${record.status}, expected ${affixSet.status}`);
  } catch (error) {
    fail(indexPath, `cannot read affix set ${affixSet.record}: ${error.message}`);
  }
}
for (const abilityIndex of index.abilityIndexes ?? []) {
  const recordPath = path.join(root, "data", abilityIndex.record);
  try {
    const record = JSON.parse(await readFile(recordPath, "utf8"));
    if (record.id !== abilityIndex.id) fail(indexPath, `${abilityIndex.record} has id ${record.id}, expected ${abilityIndex.id}`);
    if (record.status !== abilityIndex.status) fail(indexPath, `${abilityIndex.record} has status ${record.status}, expected ${abilityIndex.status}`);
  } catch (error) {
    fail(indexPath, `cannot read ability index ${abilityIndex.record}: ${error.message}`);
  }
}
const indexedDungeons = new Map((index.dungeons ?? []).map((entry) => [entry.id, entry]));
for (const { file, value: season } of records.filter(({ value }) => value.recordType === "season")) {
  for (const seasonalDungeon of season.dungeons ?? []) {
    const entry = indexedDungeons.get(seasonalDungeon.id);
    if (!entry) {
      fail(file, `season dungeon ${seasonalDungeon.id} is absent from data/index.json`);
      continue;
    }
    const dungeonRecord = records.find(({ value }) => value.recordType === "dungeon" && value.id === seasonalDungeon.id)?.value;
    if (!dungeonRecord) fail(file, `season dungeon ${seasonalDungeon.id} has no loaded dungeon record`);
    else if (dungeonRecord.challengeMapId !== seasonalDungeon.challengeMapId) {
      fail(file, `${seasonalDungeon.id} challengeMapId ${seasonalDungeon.challengeMapId} does not match dungeon record ${dungeonRecord.challengeMapId}`);
    }
  }
}
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
for (const { file, value } of records.filter(({ value }) => value.recordType === "route")) {
  if (file.includes(`${path.sep}examples${path.sep}`)) continue;
  const dungeon = dungeons.find(({ value: candidate }) => candidate.id === value.dungeonId);
  if (!dungeon) {
    fail(file, `route references unknown dungeon ${value.dungeonId}`);
    continue;
  }
  if (dungeon.value.challengeMapId !== value.challengeMapId) {
    fail(file, `challengeMapId ${value.challengeMapId} does not match ${value.dungeonId}`);
  }
  if (dungeon.value.instanceMapId !== value.instanceMapId) {
    fail(file, `instanceMapId ${value.instanceMapId} does not match ${value.dungeonId}`);
  }
  if (value.keyLevel && value.keyLevel.maximum < value.keyLevel.minimum) {
    fail(file, "keyLevel.maximum is below keyLevel.minimum");
  }
  const knownEnemies = new Map(dungeon.value.enemies.map((enemy) => [enemy.npcId, enemy]));
  const knownEncounters = new Set(dungeon.value.encounters.map((encounter) => encounter.encounterId));
  let cumulativeEnemyForces = 0;
  for (const pull of value.pulls ?? []) {
    let pullEnemyForces = 0;
    for (const enemy of pull.enemies ?? []) {
      const canonical = knownEnemies.get(enemy.npcId);
      if (!canonical) {
        fail(file, `${pull.id} references unknown NPC ${enemy.npcId}`);
        continue;
      }
      if (canonical.enemyForces !== enemy.enemyForcesEach) {
        fail(file, `${pull.id} gives NPC ${enemy.npcId} ${enemy.enemyForcesEach} forces; canonical value is ${canonical.enemyForces}`);
      }
      pullEnemyForces += canonical.enemyForces * enemy.count;
    }
    if (pull.enemyForces !== pullEnemyForces) fail(file, `${pull.id} enemyForces does not match its enemies`);
    cumulativeEnemyForces += pullEnemyForces;
    if (pull.cumulativeEnemyForces !== cumulativeEnemyForces) fail(file, `${pull.id} cumulativeEnemyForces is incorrect`);
    if (pull.afterEncounterId !== null && pull.afterEncounterId !== undefined && !knownEncounters.has(pull.afterEncounterId)) {
      fail(file, `${pull.id} references unknown encounter ${pull.afterEncounterId}`);
    }
  }
  if (value.targetEnemyForces !== cumulativeEnemyForces) fail(file, "targetEnemyForces does not match final cumulative enemy forces");
  if (value.targetEnemyForces < dungeon.value.enemyForcesTotal) {
    fail(file, `route plans ${value.targetEnemyForces} forces but dungeon requires ${dungeon.value.enemyForcesTotal}`);
  }
}
const routesById = new Map(records.filter(({ value }) => value.recordType === "route").map(({ value }) => [value.id, value]));
for (const { file, value } of records.filter(({ value }) => value.recordType === "route-catalog")) {
  if (file.includes(`${path.sep}examples${path.sep}`)) continue;
  if (value.validity?.seasonSlug !== value.seasonSlug) fail(file, "catalog seasonSlug does not match validity");
  const catalogRouteIds = new Set((value.entries ?? []).map((entry) => entry.routeId));
  const scopedRoutes = [...routesById.values()].filter((route) => route.validity?.seasonSlug === value.seasonSlug
    && route.routeKind === value.scope?.routeKind
    && route.keyLevel?.minimum === value.scope?.minimumKey
    && route.keyLevel?.maximum === value.scope?.maximumKey);
  for (const route of scopedRoutes) {
    if (!catalogRouteIds.has(route.id)) fail(file, `catalog omits scoped route ${route.id}`);
  }
  for (const entry of value.entries ?? []) {
    const route = routesById.get(entry.routeId);
    const dungeon = dungeons.find(({ value: candidate }) => candidate.id === entry.dungeonId)?.value;
    if (!route) {
      fail(file, `${entry.dungeonId} references unknown route ${entry.routeId}`);
      continue;
    }
    if (!dungeon) {
      fail(file, `catalog references unknown dungeon ${entry.dungeonId}`);
      continue;
    }
    if (route.dungeonId !== entry.dungeonId) fail(file, `${entry.routeId} belongs to ${route.dungeonId}, not ${entry.dungeonId}`);
    if (route.validity?.seasonSlug !== value.seasonSlug) fail(file, `${entry.routeId} is outside catalog season ${value.seasonSlug}`);
    if (route.routeKind !== value.scope?.routeKind) fail(file, `${entry.routeId} routeKind is outside catalog scope`);
    if (route.keyLevel?.minimum !== value.scope?.minimumKey || route.keyLevel?.maximum !== value.scope?.maximumKey) {
      fail(file, `${entry.routeId} key range is outside catalog scope`);
    }
    if (entry.routeStatus !== route.status) fail(file, `${entry.routeId} routeStatus is stale`);
    if (entry.requiredEnemyForces !== dungeon.enemyForcesTotal) fail(file, `${entry.routeId} requiredEnemyForces is stale`);
    if (entry.plannedEnemyForces !== route.targetEnemyForces) fail(file, `${entry.routeId} plannedEnemyForces is stale`);
    if (entry.surplusEnemyForces !== route.targetEnemyForces - dungeon.enemyForcesTotal) fail(file, `${entry.routeId} surplusEnemyForces is stale`);
    if (entry.pullCount !== route.pulls.length) fail(file, `${entry.routeId} pullCount is stale`);
    const bossCheckpointCount = route.pulls.filter((pull) => pull.afterEncounterId != null).length;
    if (entry.bossCheckpointCount !== bossCheckpointCount) fail(file, `${entry.routeId} bossCheckpointCount is stale`);
  }
}
for (const { file, value } of records.filter(({ value }) => value.recordType === "run-observation")) {
  if (file.includes(`${path.sep}examples${path.sep}`)) continue;
  const dungeon = dungeons.find(({ value: candidate }) => candidate.challengeMapId === value.run?.challengeMapId);
  if (!dungeon) {
    fail(file, `no dungeon has challengeMapId ${value.run?.challengeMapId}`);
    continue;
  }
  const knownEnemies = new Map(dungeon.value.enemies.map((enemy) => [enemy.npcId, enemy]));
  const knownEncounters = new Set(dungeon.value.encounters.map((encounter) => encounter.encounterId));
  for (const pull of value.pulls ?? []) {
    let enemyForces = 0;
    for (const enemy of pull.enemies ?? []) {
      const canonical = knownEnemies.get(enemy.npcId);
      if (!canonical) fail(file, `observed pull ${pull.order} references unknown NPC ${enemy.npcId}`);
      else enemyForces += canonical.enemyForces * enemy.count;
    }
    if ((!pull.enemyForcesSource || pull.enemyForcesSource === "canonical-npc-sum") && pull.enemyForces !== enemyForces) {
      fail(file, `observed pull ${pull.order} enemyForces does not match its enemies`);
    }
  }
  for (const encounter of value.encounters ?? []) {
    if (!knownEncounters.has(encounter.encounterId)) fail(file, `unknown observed encounter ${encounter.encounterId} for ${dungeon.value.id}`);
  }
  if (!value.run?.routePlanId) continue;
  const route = routesById.get(value.run.routePlanId);
  if (!route) {
    fail(file, `routePlanId references unknown route ${value.run.routePlanId}`);
    continue;
  }
  if (route.challengeMapId !== value.run.challengeMapId) fail(file, "routePlanId challengeMapId does not match the observed run");
  const knownPullIds = new Set(route.pulls.map((pull) => pull.id));
  for (const pull of value.pulls ?? []) {
    if (pull.plannedPullId && !knownPullIds.has(pull.plannedPullId)) {
      fail(file, `observed pull ${pull.order} references unknown planned pull ${pull.plannedPullId}`);
    }
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
