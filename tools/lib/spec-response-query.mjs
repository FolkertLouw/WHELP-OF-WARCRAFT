import { queryAbilityResponses } from "./ability-response-query.mjs";

const universalActions = new Set(["avoid", "line-of-sight"]);

export function querySpecResponses(responseRecords, capabilityRecord, filters = {}) {
  if (capabilityRecord?.recordType !== "spec-capabilities") throw new TypeError("capabilityRecord must be a WHELP spec-capabilities record");
  if (filters.coverage && !["full", "partial", "none"].includes(filters.coverage)) throw new Error(`unknown coverage ${filters.coverage}`);
  const generic = queryAbilityResponses(responseRecords, filters);
  const results = generic.results.map((entry) => {
    const actionCoverage = entry.actions.map((action) => {
      if (universalActions.has(action)) return { action, support: "universal", tools: [] };
      const tools = capabilityRecord.tools
        .filter((tool) => tool.actions.includes(action))
        .map(({ id, name, spellId, availability, scope, limitations }) => ({ id, name, spellId, availability, scope, limitations }));
      const selfOnly = tools.length && tools.every((tool) => tool.scope === "self");
      return { action, support: tools.length ? (selfOnly ? "conditional-self" : "spec-tool") : "unsupported", tools };
    });
    const supported = actionCoverage.filter((action) => action.support !== "unsupported").length;
    const coverage = supported === actionCoverage.length ? "full" : supported === 0 ? "none" : "partial";
    return { ...entry, coverage, actionCoverage };
  }).filter((entry) => !filters.coverage || entry.coverage === filters.coverage);
  return {
    schemaVersion: 1,
    spec: capabilityRecord.spec,
    sourceRecordId: capabilityRecord.id,
    query: { ...generic.query, coverage: filters.coverage ?? null },
    resultCount: results.length,
    results
  };
}
