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
  } else if (value.recordType === "spec-capabilities") {
    requireFields(file, value, ["id", "status", "validity", "spec", "tools", "provenance"]);
    if (!Number.isInteger(value.spec?.specId) || value.spec.specId < 1) fail(file, "spec.specId must be a positive integer");
    const toolIds = (value.tools ?? []).map((tool) => tool.id);
    const spellIds = (value.tools ?? []).flatMap((tool) => [tool.spellId, ...(tool.alternateSpellIds ?? [])]);
    if (new Set(toolIds).size !== toolIds.length) fail(file, "spec capability tool IDs must be unique");
    if (new Set(spellIds).size !== spellIds.length) fail(file, "spec capability spell IDs must be unique");
    const allowedCapabilityActions = new Set(["interrupt", "purge", "cleanse-magic", "cleanse-curse", "cleanse-disease", "cleanse-poison", "cleanse-bleed", "cleanse-snare", "cleanse-root", "cleanse-fear", "cleanse-charm", "cleanse-sleep", "soothe", "defensive", "spell-reflection", "target-drop", "crowd-control", "enemy-reposition", "healing-reduction", "enemy-damage-reduction", "enemy-damage-taken-increase", "enemy-output-slow", "reveal-stealth", "detection-reduction", "group-stealth", "group-movement", "external-movement", "group-consumable", "threat-transfer", "external-defensive", "external-offensive", "battle-resurrection", "party-damage-reduction", "party-health-increase", "bloodlust", "group-buff"]);
    const allowedAvailability = new Set(["baseline", "specialization", "talent"]);
    const allowedScopes = new Set(["enemy", "friendly-single", "friendly-periodic-area", "friendly-area", "self", "area-enemy", "mixed-area"]);
    for (const tool of value.tools ?? []) {
      requireFields(file, tool, ["id", "name", "spellId", "actions", "availability", "scope", "limitations"]);
      if (!(tool.actions ?? []).length) fail(file, `spec tool ${tool.id} has no actions`);
      for (const action of tool.actions ?? []) {
        if (!allowedCapabilityActions.has(action)) fail(file, `spec tool ${tool.id} has unknown action ${action}`);
      }
      for (const [action, availability] of Object.entries(tool.actionAvailability ?? {})) {
        if (!(tool.actions ?? []).includes(action)) fail(file, `spec tool ${tool.id} overrides availability for absent action ${action}`);
        if (!allowedAvailability.has(availability)) fail(file, `spec tool ${tool.id} has unknown action availability ${availability}`);
      }
      if (!allowedAvailability.has(tool.availability)) fail(file, `spec tool ${tool.id} has unknown availability ${tool.availability}`);
      if (!allowedScopes.has(tool.scope)) fail(file, `spec tool ${tool.id} has unknown scope ${tool.scope}`);
      for (const requirement of tool.requirements ?? []) {
        if (!requirement.kind?.trim() || !requirement.value?.trim()) fail(file, `spec tool ${tool.id} has an invalid requirement`);
      }
    }
  } else if (value.recordType === "spec-capability-coverage") {
    requireFields(file, value, ["id", "status", "validity", "isComplete", "entries", "missingDataMeaning", "provenance"]);
    const specIds = (value.entries ?? []).map((entry) => entry.specId);
    const slugs = (value.entries ?? []).map((entry) => entry.slug);
    const recordIds = (value.entries ?? []).map((entry) => entry.recordId);
    if (new Set(specIds).size !== specIds.length) fail(file, "capability coverage spec IDs must be unique");
    if (new Set(slugs).size !== slugs.length) fail(file, "capability coverage slugs must be unique");
    if (new Set(recordIds).size !== recordIds.length) fail(file, "capability coverage record IDs must be unique");
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
  } else if (value.recordType === "source-freshness-policy") {
    requireFields(file, value, ["id", "status", "evaluatedRoots", "agingAtFraction", "maxAgeDaysByKind", "timestampRequiredKinds", "timestampFallbackFields", "provenance"]);
    if (!(value.agingAtFraction > 0 && value.agingAtFraction < 1)) fail(file, "agingAtFraction must be between zero and one");
    if (!(value.evaluatedRoots ?? []).length || new Set(value.evaluatedRoots).size !== value.evaluatedRoots.length) fail(file, "evaluatedRoots must be non-empty and unique");
    const sourceKinds = new Set(["official-api", "official-publisher", "game-data", "local-client", "addon-observation", "combat-log", "curated", "external-reference"]);
    for (const [kind, days] of Object.entries(value.maxAgeDaysByKind ?? {})) {
      if (!sourceKinds.has(kind)) fail(file, `freshness policy has unknown source kind ${kind}`);
      if (!Number.isInteger(days) || days < 1) fail(file, `freshness policy age for ${kind} must be a positive integer`);
    }
    for (const kind of value.timestampRequiredKinds ?? []) {
      if (!sourceKinds.has(kind)) fail(file, `freshness policy requires timestamp for unknown source kind ${kind}`);
      if (value.maxAgeDaysByKind?.[kind] === undefined) fail(file, `timestamp-required source kind ${kind} has no maximum age`);
    }
  } else if (value.recordType === "source-claim-audit") {
    requireFields(file, value, ["id", "status", "validity", "source", "claims", "provenance"]);
    requireFields(file, value.source ?? {}, ["title", "url", "retrievedAt"]);
    const claimIds = (value.claims ?? []).map((claim) => claim.claimId);
    if (!(value.claims ?? []).length) fail(file, "source claim audit must contain at least one claim");
    if (new Set(claimIds).size !== claimIds.length) fail(file, "source claim IDs must be unique");
    for (const claim of value.claims ?? []) {
      requireFields(file, claim, ["claimId", "assertedDungeonId", "sectionLabel", "subjectName", "disposition", "reason", "evidence"]);
      if (!["accepted", "rejected-cross-dungeon", "rejected-placeholder", "unresolved"].includes(claim.disposition)) {
        fail(file, `claim ${claim.claimId} has unknown disposition ${claim.disposition}`);
      }
      if (claim.claimType && !["mechanic-location", "utility-rating", "utility-mention", "placeholder"].includes(claim.claimType)) {
        fail(file, `claim ${claim.claimId} has unknown claim type ${claim.claimType}`);
      }
      if (claim.claimType === "utility-rating") {
        requireFields(file, claim, ["specSlug", "axisId", "assertedRating"]);
        if (!["always", "niche", "none"].includes(claim.assertedRating)) {
          fail(file, `utility-rating claim ${claim.claimId} has invalid rating ${claim.assertedRating}`);
        }
      }
      if (claim.claimType === "utility-mention") {
        requireFields(file, claim, ["specSlug", "axisId"]);
      }
      if (claim.claimType === "placeholder" && claim.disposition !== "rejected-placeholder") {
        fail(file, `placeholder claim ${claim.claimId} must be rejected-placeholder`);
      }
      if (!(claim.evidence ?? []).length) fail(file, `claim ${claim.claimId} has no evidence`);
      if (claim.disposition === "accepted" && claim.canonicalDungeonId !== claim.assertedDungeonId) {
        fail(file, `accepted claim ${claim.claimId} must resolve to its asserted dungeon`);
      }
      if (claim.disposition === "rejected-cross-dungeon"
        && (!claim.canonicalDungeonId || claim.canonicalDungeonId === claim.assertedDungeonId)) {
        fail(file, `rejected claim ${claim.claimId} must resolve to a different dungeon`);
      }
      if (claim.disposition === "unresolved" && claim.canonicalDungeonId !== null) {
        fail(file, `unresolved claim ${claim.claimId} cannot assert a canonical dungeon`);
      }
      if (claim.disposition === "rejected-placeholder" && claim.canonicalDungeonId !== null) {
        fail(file, `placeholder claim ${claim.claimId} cannot assert a canonical dungeon`);
      }
    }
  } else if (value.recordType === "source-audit-coverage") {
    requireFields(file, value, ["id", "status", "validity", "isCatalogComplete", "summary", "entries", "missingAuditMeaning", "provenance"]);
    requireFields(file, value.summary ?? {}, ["specializationCount", "fullyAudited", "partiallyAudited", "provenanceOnly", "noSource"]);
    const levels = ["fully-audited", "partially-audited", "provenance-only", "no-source"];
    const specSlugs = (value.entries ?? []).map((entry) => entry.specSlug);
    const matrixIds = (value.entries ?? []).map((entry) => entry.matrixId);
    if (new Set(specSlugs).size !== specSlugs.length) fail(file, "source audit coverage spec slugs must be unique");
    if (new Set(matrixIds).size !== matrixIds.length) fail(file, "source audit coverage matrix IDs must be unique");
    for (const entry of value.entries ?? []) {
      requireFields(file, entry, ["specId", "specSlug", "matrixId", "coverageLevel", "sourceUrls", "auditIds", "claimCount", "claimsByType", "claimsByDisposition", "limitations"]);
      if (!levels.includes(entry.coverageLevel)) fail(file, `unknown source audit coverage level ${entry.coverageLevel}`);
      if (entry.claimCount !== Object.values(entry.claimsByDisposition ?? {}).reduce((sum, count) => sum + count, 0)) {
        fail(file, `source audit coverage claim count disagrees for ${entry.specSlug}`);
      }
    }
    const summaryTotal = value.summary.fullyAudited + value.summary.partiallyAudited + value.summary.provenanceOnly + value.summary.noSource;
    if (summaryTotal !== value.entries.length || value.summary.specializationCount !== value.entries.length) {
      fail(file, "source audit coverage summary does not match entries");
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

  const allowedProvenanceKinds = new Set(["official-api", "official-publisher", "game-data", "local-client", "addon-observation", "combat-log", "curated", "external-reference"]);
  for (const source of value.provenance ?? []) {
    requireFields(file, source, ["kind", "description"]);
    if (!allowedProvenanceKinds.has(source.kind)) fail(file, `unknown provenance kind ${source.kind}`);
    if (source.retrievedAt) {
      const retrievedAt = Date.parse(source.retrievedAt);
      if (Number.isNaN(retrievedAt)) fail(file, `invalid provenance retrievedAt ${source.retrievedAt}`);
      else if (retrievedAt > Date.now() + 300_000) fail(file, `provenance retrievedAt is future-dated: ${source.retrievedAt}`);
    }
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
const abilityIndexes = records.filter(({ value }) => value.recordType === "ability-index");
const specMatrices = records.filter(({ value }) => value.recordType === "spec-dungeon-matrix");
for (const { file, value } of records.filter(({ value }) => value.recordType === "source-claim-audit")) {
  if (file.includes(`${path.sep}examples${path.sep}`)) continue;
  for (const claim of value.claims ?? []) {
    if (!dungeons.some(({ value: dungeon }) => dungeon.id === claim.assertedDungeonId)) {
      fail(file, `claim ${claim.claimId} asserts unknown dungeon ${claim.assertedDungeonId}`);
    }
    if (claim.disposition === "accepted" && claim.spellId) {
      const matchingAbilities = abilityIndexes.flatMap(({ value: index }) => (index.abilities ?? [])
        .filter((ability) => ability.spellId === claim.spellId));
      if (!matchingAbilities.length) {
        fail(file, `accepted claim ${claim.claimId} references spell ${claim.spellId}, which is absent from ability indexes`);
      } else if (!matchingAbilities.some((ability) => (ability.contexts ?? [])
        .some((context) => context.dungeonId === claim.canonicalDungeonId))) {
        fail(file, `accepted claim ${claim.claimId} has no ability-index context for ${claim.canonicalDungeonId}`);
      }
    }
    if (claim.disposition === "accepted" && ["utility-rating", "utility-mention"].includes(claim.claimType)) {
      const expectedMatrixId = `${value.validity?.seasonSlug}/${claim.specSlug}-utility-matrix`;
      const matrix = specMatrices.find(({ value: candidate }) => candidate.id === expectedMatrixId)?.value;
      const dungeonEntry = matrix?.dungeons?.find((entry) => entry.dungeonId === claim.canonicalDungeonId);
      if (!matrix) fail(file, `${claim.claimType} claim ${claim.claimId} has no matrix for ${claim.specSlug}`);
      else if (!matrix.axes?.some((axis) => axis.id === claim.axisId)) fail(file, `${claim.claimType} claim ${claim.claimId} has unknown axis ${claim.axisId}`);
      else if (!dungeonEntry) fail(file, `${claim.claimType} claim ${claim.claimId} has no matrix dungeon ${claim.canonicalDungeonId}`);
      else if (claim.claimType === "utility-rating" && dungeonEntry.ratings?.[claim.axisId] !== claim.assertedRating) {
        fail(file, `utility-rating claim ${claim.claimId} disagrees with matrix rating ${dungeonEntry.ratings?.[claim.axisId] ?? "missing"}`);
      } else if (claim.claimType === "utility-mention" && !["always", "niche"].includes(dungeonEntry.ratings?.[claim.axisId])) {
        fail(file, `utility-mention claim ${claim.claimId} maps to non-usable matrix rating ${dungeonEntry.ratings?.[claim.axisId] ?? "missing"}`);
      }
    }
    if (!claim.spellId || claim.disposition === "accepted") continue;
    for (const { file: matrixFile, value: matrix } of records.filter(({ value: candidate }) => candidate.recordType === "spec-dungeon-matrix")) {
      const dungeonEntry = (matrix.dungeons ?? []).find((entry) => entry.dungeonId === claim.assertedDungeonId);
      if ((dungeonEntry?.mechanicSpellIds ?? []).includes(claim.spellId)) {
        fail(matrixFile, `mechanic spell ${claim.spellId} is ${claim.disposition} for ${claim.assertedDungeonId} by ${value.id}`);
      }
    }
  }
}
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
    const indexedContexts = indexed.contexts.filter((context) => context.dungeonId === value.dungeonId);
    const indexedNpcIds = new Set(indexedContexts.map((context) => context.npcId));
    for (const npcId of entry.npcIds ?? []) {
      if (!knownNpcIds.has(npcId)) fail(file, `response spell ${entry.spellId} references unknown NPC ${npcId}`);
      if (!indexedNpcIds.has(npcId)) fail(file, `response spell ${entry.spellId} is not indexed for NPC ${npcId}`);
    }
    const actions = new Set(entry.actions ?? []);
    const selectedContexts = indexedContexts.filter((context) => (entry.npcIds ?? []).includes(context.npcId));
    if (actions.has("interrupt") && !selectedContexts.some((context) => context.interruptible === true)) {
      fail(file, `response spell ${entry.spellId} claims interrupt without an interruptible indexed context`);
    }
    if (actions.has("soothe") && !selectedContexts.some((context) => context.enrage === true)) {
      fail(file, `response spell ${entry.spellId} claims soothe without an Enrage indexed context`);
    }
    const requiredDispelTypes = new Map([
      ["purge", "magic"],
      ["cleanse-magic", "magic"],
      ["cleanse-curse", "curse"],
      ["cleanse-disease", "disease"],
      ["cleanse-poison", "poison"],
    ]);
    for (const [action, dispelType] of requiredDispelTypes) {
      if (actions.has(action) && !selectedContexts.some((context) => context.dispelType === dispelType)) {
        fail(file, `response spell ${entry.spellId} claims ${action} without an indexed ${dispelType} flag`);
      }
    }
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
  const indexedResponseDungeons = new Set((value.entries ?? []).map((entry) => entry.dungeonId));
  const scopedResponses = [...abilityResponsesById.values()].filter((response) => response.validity?.seasonSlug === value.seasonSlug);
  for (const response of scopedResponses) {
    if (!indexedResponseIds.has(response.id)) fail(file, `response index omits scoped record ${response.id}`);
  }
  const season = records.find(({ value: candidate }) => candidate.recordType === "season" && candidate.id === value.seasonSlug)?.value;
  if (!season) fail(file, `response index references unknown season ${value.seasonSlug}`);
  else {
    for (const dungeon of season.dungeons ?? []) {
      if (!indexedResponseDungeons.has(dungeon.id)) fail(file, `response index omits seasonal dungeon ${dungeon.id}`);
    }
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
  const capability = records.find(({ value: candidate }) => candidate.recordType === "spec-capabilities"
    && candidate.spec?.classId === value.spec?.classId && candidate.spec?.specId === value.spec?.specId)?.value;
  if (value.axes?.some((axis) => axis.toolIds?.length) && !capability) {
    fail(file, `matrix toolIds cannot resolve because spec ${value.spec?.specId} has no capability record`);
  }
  const toolsById = new Map((capability?.tools ?? []).map((tool) => [tool.id, tool]));
  for (const axis of value.axes ?? []) {
    for (const toolId of axis.toolIds ?? []) {
      const tool = toolsById.get(toolId);
      if (!tool) {
        fail(file, `utility axis ${axis.id} references unknown spec tool ${toolId}`);
        continue;
      }
      if (!(axis.abilityNames ?? []).includes(tool.name)) fail(file, `utility axis ${axis.id} omits the name of tool ${toolId}`);
      if (!(axis.spellIds ?? []).includes(tool.spellId)) fail(file, `utility axis ${axis.id} omits the spell ID of tool ${toolId}`);
    }
  }
  for (const entry of value.dungeons ?? []) {
    const dungeon = dungeons.find(({ value: candidate }) => candidate.id === entry.dungeonId);
    if (!dungeon) fail(file, `matrix references unknown dungeon ${entry.dungeonId}`);
    else if (dungeon.value.instanceMapId !== entry.instanceMapId) {
      fail(file, `${entry.dungeonId} instanceMapId ${entry.instanceMapId} does not match dungeon record ${dungeon.value.instanceMapId}`);
    }
    const knownMechanicSpellIds = new Set();
    for (const { value: candidate } of records) {
      if (candidate.recordType === "route" && candidate.dungeonId === entry.dungeonId) {
        for (const pull of candidate.pulls ?? []) for (const spellId of pull.dangerousSpellIds ?? []) knownMechanicSpellIds.add(spellId);
      } else if (candidate.recordType === "mechanic" && candidate.id?.startsWith(`${entry.dungeonId}/`)) {
        if (candidate.mechanic?.spellId) knownMechanicSpellIds.add(candidate.mechanic.spellId);
      } else if (candidate.recordType === "ability-response" && candidate.dungeonId === entry.dungeonId) {
        for (const response of candidate.entries ?? []) knownMechanicSpellIds.add(response.spellId);
      } else if (candidate.recordType === "ability-index") {
        for (const ability of candidate.abilities ?? []) {
          if ((ability.contexts ?? []).some((context) => context.dungeonId === entry.dungeonId)) knownMechanicSpellIds.add(ability.spellId);
        }
      }
    }
    for (const spellId of entry.mechanicSpellIds ?? []) {
      if (!knownMechanicSpellIds.has(spellId)) fail(file, `${entry.dungeonId} references unknown mechanic spell ${spellId}`);
    }
  }
  for (const affix of value.affixes ?? []) {
    if (!affixDefinitions.has(affix.affixSlug)) fail(file, `matrix references unknown affix ${affix.affixSlug}`);
  }
}
const capabilitySpecIds = new Map();
const capabilitySlugs = new Map();
for (const { file, value } of records.filter(({ value }) => value.recordType === "spec-capabilities")) {
  if (capabilitySpecIds.has(value.spec?.specId)) fail(file, `specId ${value.spec?.specId} duplicates ${capabilitySpecIds.get(value.spec.specId)}`);
  else capabilitySpecIds.set(value.spec?.specId, file);
  if (capabilitySlugs.has(value.spec?.slug)) fail(file, `spec slug ${value.spec?.slug} duplicates ${capabilitySlugs.get(value.spec.slug)}`);
  else capabilitySlugs.set(value.spec?.slug, file);
  if (!value.matrixRecordId) continue;
  const matrix = records.find(({ value: candidate }) => candidate.recordType === "spec-dungeon-matrix"
    && candidate.id === value.matrixRecordId)?.value;
  if (!matrix) fail(file, `matrixRecordId references missing utility matrix ${value.matrixRecordId}`);
  else {
    if (matrix.spec?.specId !== value.spec?.specId || matrix.spec?.classId !== value.spec?.classId || matrix.spec?.specName !== value.spec?.specName) {
      fail(file, `spec identity does not match utility matrix ${matrix.id}`);
    }
    if (matrix.validity?.seasonSlug !== value.validity?.seasonSlug) {
      fail(file, `season ${value.validity?.seasonSlug} does not match utility matrix ${matrix.id}`);
    }
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
for (const capability of index.specCapabilities ?? []) {
  const recordPath = path.join(root, "data", capability.record);
  try {
    const record = JSON.parse(await readFile(recordPath, "utf8"));
    if (record.id !== capability.id) fail(indexPath, `${capability.record} has id ${record.id}, expected ${capability.id}`);
    if (record.status !== capability.status) fail(indexPath, `${capability.record} has status ${record.status}, expected ${capability.status}`);
  } catch (error) {
    fail(indexPath, `cannot read spec capability ${capability.record}: ${error.message}`);
  }
}
for (const audit of index.sourceClaimAudits ?? []) {
  const recordPath = path.join(root, "data", audit.record);
  try {
    const record = JSON.parse(await readFile(recordPath, "utf8"));
    if (record.recordType !== "source-claim-audit") fail(indexPath, `${audit.record} is not a source-claim-audit record`);
    if (record.id !== audit.id) fail(indexPath, `${audit.record} has id ${record.id}, expected ${audit.id}`);
    if (record.status !== audit.status) fail(indexPath, `${audit.record} has status ${record.status}, expected ${audit.status}`);
  } catch (error) {
    fail(indexPath, `cannot read source claim audit ${audit.record}: ${error.message}`);
  }
}
const indexedAuditIds = new Set((index.sourceClaimAudits ?? []).map((entry) => entry.id));
for (const { file, value } of records.filter(({ value }) => value.recordType === "source-claim-audit")) {
  if (file.includes(`${path.sep}examples${path.sep}`)) continue;
  if (!indexedAuditIds.has(value.id)) fail(file, `source claim audit ${value.id} is absent from data/index.json`);
}
if (index.sourceAuditCoverage) {
  const coveragePath = path.join(root, "data", index.sourceAuditCoverage.record);
  try {
    const coverage = JSON.parse(await readFile(coveragePath, "utf8"));
    if (coverage.recordType !== "source-audit-coverage") fail(indexPath, `${index.sourceAuditCoverage.record} is not a source-audit-coverage record`);
    if (coverage.id !== index.sourceAuditCoverage.id) fail(indexPath, `${index.sourceAuditCoverage.record} has id ${coverage.id}, expected ${index.sourceAuditCoverage.id}`);
    if (coverage.status !== index.sourceAuditCoverage.status) fail(indexPath, `${index.sourceAuditCoverage.record} has status ${coverage.status}, expected ${index.sourceAuditCoverage.status}`);
  } catch (error) {
    fail(indexPath, `cannot read source audit coverage ${index.sourceAuditCoverage.record}: ${error.message}`);
  }
}
if (index.specCapabilityCoverage) {
  const coveragePath = path.join(root, "data", index.specCapabilityCoverage.record);
  try {
    const coverage = JSON.parse(await readFile(coveragePath, "utf8"));
    if (coverage.id !== index.specCapabilityCoverage.id) fail(indexPath, `${index.specCapabilityCoverage.record} has id ${coverage.id}, expected ${index.specCapabilityCoverage.id}`);
    if (coverage.status !== index.specCapabilityCoverage.status) fail(indexPath, `${index.specCapabilityCoverage.record} has status ${coverage.status}, expected ${index.specCapabilityCoverage.status}`);
    const expected = (index.specCapabilities ?? []).map((entry) => entry.id).sort();
    const actual = (coverage.entries ?? []).map((entry) => entry.recordId).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(coveragePath, "coverage entries must exactly match indexed spec capability records");
    for (const entry of coverage.entries ?? []) {
      const capability = records.find(({ value }) => value.recordType === "spec-capabilities" && value.id === entry.recordId)?.value;
      if (!capability) continue;
      if (capability.spec.specId !== entry.specId || capability.spec.slug !== entry.slug) fail(coveragePath, `coverage identity does not match ${entry.recordId}`);
    }
  } catch (error) {
    fail(indexPath, `cannot read spec capability coverage ${index.specCapabilityCoverage.record}: ${error.message}`);
  }
}
if (index.sourceFreshnessPolicy) {
  const policyPath = path.join(root, "data", index.sourceFreshnessPolicy.record);
  try {
    const policy = JSON.parse(await readFile(policyPath, "utf8"));
    if (policy.id !== index.sourceFreshnessPolicy.id) fail(indexPath, `${index.sourceFreshnessPolicy.record} has id ${policy.id}, expected ${index.sourceFreshnessPolicy.id}`);
    if (policy.status !== index.sourceFreshnessPolicy.status) fail(indexPath, `${index.sourceFreshnessPolicy.record} has status ${policy.status}, expected ${index.sourceFreshnessPolicy.status}`);
    const required = new Set(policy.timestampRequiredKinds ?? []);
    for (const { file, value } of records) {
      if (!policy.evaluatedRoots.some((entry) => file.startsWith(path.join(root, entry) + path.sep))) continue;
      for (const source of value.provenance ?? []) {
        if (!required.has(source.kind) || source.retrievedAt) continue;
        const hasFallback = (policy.timestampFallbackFields ?? []).some((field) => value[field]);
        if (!hasFallback) fail(file, `provenance kind ${source.kind} requires retrievedAt or a declared record timestamp fallback`);
      }
    }
  } catch (error) {
    fail(indexPath, `cannot read source freshness policy ${index.sourceFreshnessPolicy.record}: ${error.message}`);
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
