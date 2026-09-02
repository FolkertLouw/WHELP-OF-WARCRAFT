const allowedActions = new Set(["interrupt", "purge", "cleanse-magic", "cleanse-curse", "cleanse-disease", "cleanse-poison", "cleanse-snare", "cleanse-root", "cleanse-fear", "cleanse-charm", "cleanse-sleep", "soothe", "defensive", "target-drop", "crowd-control", "enemy-reposition", "healing-reduction", "reveal-stealth", "external-defensive", "external-offensive", "battle-resurrection", "party-damage-reduction", "bloodlust", "group-buff"]);
const allowedScopes = new Set(["enemy", "friendly-single", "friendly-periodic-area", "friendly-area", "self", "area-enemy", "mixed-area"]);

export function queryCapabilities(capabilityRecords, filters = {}) {
  if (!Array.isArray(capabilityRecords)) throw new TypeError("capabilityRecords must be an array");
  if (capabilityRecords.some((record) => record?.recordType !== "spec-capabilities")) throw new TypeError("every capability record must be a WHELP spec-capabilities record");
  if (filters.action && !allowedActions.has(filters.action)) throw new Error(`unknown capability action ${filters.action}`);
  if (filters.scope && !allowedScopes.has(filters.scope)) throw new Error(`unknown capability scope ${filters.scope}`);
  const requestedSpecs = filters.specs ?? [];
  if (!Array.isArray(requestedSpecs)) throw new TypeError("filters.specs must be an array");
  const knownSlugs = new Set(capabilityRecords.map((record) => record.spec?.slug));
  for (const slug of requestedSpecs) {
    if (!knownSlugs.has(slug)) throw new Error(`unknown spec ${slug}`);
  }

  const selected = capabilityRecords.filter((record) => !requestedSpecs.length || requestedSpecs.includes(record.spec.slug));
  const results = selected.flatMap((record) => record.tools
    .filter((tool) => !filters.action || tool.actions.includes(filters.action))
    .filter((tool) => !filters.scope || tool.scope === filters.scope)
    .map((tool) => {
      const actions = filters.action ? [filters.action] : tool.actions;
      return {
        spec: record.spec,
        sourceRecordId: record.id,
        tool: {
          id: tool.id,
          name: tool.name,
          spellId: tool.spellId,
          alternateSpellIds: tool.alternateSpellIds ?? [],
          actions,
          availabilityByAction: Object.fromEntries(actions.map((action) => [action, tool.actionAvailability?.[action] ?? tool.availability])),
          scope: tool.scope,
          requirements: tool.requirements ?? [],
          limitations: tool.limitations
        }
      };
    }));

  return {
    schemaVersion: 1,
    query: { specs: requestedSpecs, action: filters.action ?? null, scope: filters.scope ?? null },
    resultCount: results.length,
    results
  };
}
