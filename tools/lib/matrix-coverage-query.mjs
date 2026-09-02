export function queryMatrixCoverage(capabilities, matrices, season) {
  if (!Array.isArray(capabilities) || capabilities.some((record) => record?.recordType !== "spec-capabilities")) {
    throw new TypeError("capabilities must contain only spec-capabilities records");
  }
  if (!Array.isArray(matrices) || matrices.some((record) => record?.recordType !== "spec-dungeon-matrix")) {
    throw new TypeError("matrices must contain only spec-dungeon-matrix records");
  }
  if (season?.recordType !== "season") throw new TypeError("season must be a season record");

  const expectedDungeonIds = season.dungeons.map((dungeon) => dungeon.id);
  const matrixById = new Map(matrices.map((matrix) => [matrix.id, matrix]));
  const entries = capabilities
    .map((capability) => {
      const matrix = capability.matrixRecordId ? matrixById.get(capability.matrixRecordId) : null;
      const dungeonIds = matrix?.dungeons.map((entry) => entry.dungeonId) ?? [];
      const missingDungeonIds = expectedDungeonIds.filter((id) => !dungeonIds.includes(id));
      const extraDungeonIds = dungeonIds.filter((id) => !expectedDungeonIds.includes(id));
      return {
        spec: capability.spec,
        capabilityRecordId: capability.id,
        matrixRecordId: capability.matrixRecordId ?? null,
        matrixStatus: matrix?.status ?? null,
        dungeonCount: dungeonIds.length,
        missingDungeonIds,
        extraDungeonIds,
        completeSeasonCoverage: Boolean(matrix) && missingDungeonIds.length === 0 && extraDungeonIds.length === 0,
      };
    })
    .sort((left, right) => left.spec.className.localeCompare(right.spec.className) || left.spec.specName.localeCompare(right.spec.specName));

  return {
    schemaVersion: 1,
    season: { id: season.id, build: season.validity.fromBuild, expectedDungeonCount: expectedDungeonIds.length },
    summary: {
      modeledSpecCount: entries.length,
      matrixSpecCount: entries.filter((entry) => entry.matrixRecordId).length,
      fullMatrixSpecCount: entries.filter((entry) => entry.completeSeasonCoverage).length,
      capabilityOnlySpecCount: entries.filter((entry) => !entry.matrixRecordId).length,
    },
    entries,
  };
}
