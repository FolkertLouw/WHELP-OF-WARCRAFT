const knownActions = new Set(["interrupt", "purge", "cleanse-magic", "cleanse-curse", "cleanse-disease", "cleanse-poison", "soothe", "defensive", "avoid", "line-of-sight", "crowd-control"]);
const knownPriorities = new Set(["critical", "high", "routine", "situational"]);

export function queryAbilityResponses(records, filters = {}) {
  if (!Array.isArray(records) || records.some((record) => record?.recordType !== "ability-response")) {
    throw new TypeError("records must contain only WHELP ability-response records");
  }
  if (filters.action && !knownActions.has(filters.action)) throw new Error(`unknown response action ${filters.action}`);
  if (filters.priority && !knownPriorities.has(filters.priority)) throw new Error(`unknown response priority ${filters.priority}`);
  if (filters.spellId !== undefined && (!Number.isInteger(filters.spellId) || filters.spellId < 1)) {
    throw new Error("spellId must be a positive integer");
  }
  const results = [];
  for (const record of records) {
    if (filters.dungeonId && record.dungeonId !== filters.dungeonId) continue;
    for (const entry of record.entries) {
      if (filters.spellId !== undefined && entry.spellId !== filters.spellId) continue;
      if (filters.action && !entry.actions.includes(filters.action)) continue;
      if (filters.priority && entry.priority !== filters.priority) continue;
      results.push({ dungeonId: record.dungeonId, instanceMapId: record.instanceMapId, recordId: record.id, validity: record.validity, ...entry });
    }
  }
  return {
    schemaVersion: 1,
    query: {
      dungeonId: filters.dungeonId ?? null,
      spellId: filters.spellId ?? null,
      action: filters.action ?? null,
      priority: filters.priority ?? null
    },
    resultCount: results.length,
    results
  };
}
