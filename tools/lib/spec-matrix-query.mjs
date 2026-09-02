const allowedRatings = new Set(["always", "niche", "none"]);

export function querySpecMatrix(matrices, capabilities, filters = {}) {
  if (!Array.isArray(matrices) || matrices.some((record) => record?.recordType !== "spec-dungeon-matrix")) {
    throw new TypeError("matrices must contain only spec-dungeon-matrix records");
  }
  if (!Array.isArray(capabilities) || capabilities.some((record) => record?.recordType !== "spec-capabilities")) {
    throw new TypeError("capabilities must contain only spec-capabilities records");
  }
  if (!filters.spec) throw new Error("spec is required");
  if (filters.rating && !allowedRatings.has(filters.rating)) throw new Error(`unknown utility rating ${filters.rating}`);

  const capability = capabilities.find((record) => record.spec.slug === filters.spec);
  if (!capability) throw new Error(`unknown spec ${filters.spec}`);
  if (!capability.matrixRecordId) throw new Error(`spec ${filters.spec} has no seasonal utility matrix`);
  const matrix = matrices.find((record) => record.id === capability.matrixRecordId);
  if (!matrix) throw new Error(`missing utility matrix ${capability.matrixRecordId}`);
  const tools = new Map(capability.tools.map((tool) => [tool.id, tool]));

  const dungeonEntries = filters.dungeon
    ? matrix.dungeons.filter((entry) => entry.dungeonId === filters.dungeon)
    : matrix.dungeons;
  if (filters.dungeon && !dungeonEntries.length) throw new Error(`matrix has no dungeon ${filters.dungeon}`);
  const affixes = filters.affix
    ? matrix.affixes.filter((entry) => entry.affixSlug === filters.affix)
    : matrix.affixes;
  if (filters.affix && !affixes.length) throw new Error(`matrix has no affix ${filters.affix}`);

  return {
    schemaVersion: 1,
    query: { spec: filters.spec, dungeon: filters.dungeon ?? null, affix: filters.affix ?? null, rating: filters.rating ?? null },
    sourceRecordId: matrix.id,
    capabilityRecordId: capability.id,
    status: matrix.status,
    validity: matrix.validity,
    spec: capability.spec,
    dungeons: dungeonEntries.map((entry) => ({
      dungeonId: entry.dungeonId,
      instanceMapId: entry.instanceMapId,
      mechanicSpellIds: entry.mechanicSpellIds ?? [],
      notes: entry.notes,
      utilities: matrix.axes
        .filter((axis) => !filters.rating || entry.ratings[axis.id] === filters.rating)
        .map((axis) => ({
          axisId: axis.id,
          label: axis.label,
          rating: entry.ratings[axis.id],
          tools: (axis.toolIds ?? []).map((toolId) => {
            const tool = tools.get(toolId);
            return { id: tool.id, name: tool.name, spellId: tool.spellId, availability: tool.availability, limitations: tool.limitations };
          }),
        })),
    })),
    affixes,
    provenance: matrix.provenance,
  };
}
