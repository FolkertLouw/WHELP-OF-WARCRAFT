import { queryAbilityResponses } from "./ability-response-query.mjs";
import { querySpecResponses } from "./spec-response-query.mjs";

const individualActions = new Set(["avoid", "line-of-sight", "defensive"]);
const availabilityRank = { baseline: 0, specialization: 1, talent: 2 };

export function buildSpecLoadout(responseRecords, capabilityRecord, dungeonId) {
  if (!dungeonId) throw new Error("dungeonId is required");
  const response = querySpecResponses(responseRecords, capabilityRecord, { dungeonId });
  const tools = new Map();
  const gaps = [];
  const universalResponses = [];
  const selfOnlyResponses = [];
  for (const mechanic of response.results) {
    for (const action of mechanic.actionCoverage) {
      const reference = { spellId: mechanic.spellId, name: mechanic.name, action: action.action, priority: mechanic.priority };
      if (action.support === "unsupported") gaps.push(reference);
      if (action.support === "universal") universalResponses.push(reference);
      if (action.support === "conditional-self") selfOnlyResponses.push(reference);
      for (const tool of action.tools) {
        const existing = tools.get(tool.id) ?? { ...tool, availabilityByAction: {}, mechanicReferences: [] };
        existing.availabilityByAction[action.action] = tool.availability;
        if (availabilityRank[tool.availability] > availabilityRank[existing.availability]) existing.availability = tool.availability;
        existing.mechanicReferences.push(reference);
        tools.set(tool.id, existing);
      }
    }
  }
  const coverageCounts = { full: 0, partial: 0, none: 0 };
  for (const mechanic of response.results) coverageCounts[mechanic.coverage] += 1;
  return {
    schemaVersion: 1,
    spec: capabilityRecord.spec,
    dungeonId,
    validity: response.results[0]?.validity ?? capabilityRecord.validity,
    coverageCounts,
    recommendedTools: [...tools.values()].sort((left, right) => left.name.localeCompare(right.name)),
    unsupportedActions: gaps,
    universalResponses,
    selfOnlyResponses
  };
}

export function buildPartyGapReport(responseRecords, capabilityRecords, dungeonId) {
  if (!dungeonId) throw new Error("dungeonId is required");
  if (!Array.isArray(capabilityRecords) || !capabilityRecords.length) throw new Error("at least one spec capability record is required");
  const generic = queryAbilityResponses(responseRecords, { dungeonId });
  const coveredUtility = [];
  const uncoveredUtility = [];
  const individualResponses = [];
  for (const mechanic of generic.results) {
    for (const action of mechanic.actions) {
      const base = { spellId: mechanic.spellId, name: mechanic.name, action, priority: mechanic.priority };
      if (individualActions.has(action)) {
        individualResponses.push(base);
        continue;
      }
      const handlers = capabilityRecords.flatMap((capability) => capability.tools
        .filter((tool) => tool.scope !== "self" && tool.actions.includes(action))
        .map((tool) => ({ specSlug: capability.spec.slug, specId: capability.spec.specId, toolId: tool.id, toolName: tool.name, spellId: tool.spellId, availability: tool.actionAvailability?.[action] ?? tool.availability, scope: tool.scope })));
      (handlers.length ? coveredUtility : uncoveredUtility).push({ ...base, handlers });
    }
  }
  return {
    schemaVersion: 1,
    dungeonId,
    partySpecs: capabilityRecords.map((record) => record.spec),
    scope: "party-utility-only",
    coveredUtility,
    uncoveredUtility,
    individualResponses
  };
}
