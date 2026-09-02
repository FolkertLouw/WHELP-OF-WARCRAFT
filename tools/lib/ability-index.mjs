const responseOrder = ["interrupt", "dispel-magic", "cleanse-curse", "cleanse-disease", "cleanse-poison", "soothe"];

export function deriveResponseTags(contexts) {
  const tags = new Set();
  for (const context of contexts) {
    if (context.interruptible) tags.add("interrupt");
    if (context.dispelType === "magic") tags.add("dispel-magic");
    if (context.dispelType === "curse") tags.add("cleanse-curse");
    if (context.dispelType === "disease") tags.add("cleanse-disease");
    if (context.dispelType === "poison") tags.add("cleanse-poison");
    if (context.enrage) tags.add("soothe");
  }
  return responseOrder.filter((tag) => tags.has(tag));
}

export function compileAbilityIndex({ season, dungeons, abilityRecords }) {
  if (season?.recordType !== "season") throw new TypeError("season must be a WHELP season record");
  const dungeonsById = new Map(dungeons.map((dungeon) => [dungeon.id, dungeon]));
  const abilitiesByInstance = new Map(abilityRecords.map((record) => [record.instanceMapId, record]));
  const abilities = new Map();
  let abilityRowCount = 0;

  for (const seasonEntry of season.dungeons) {
    const dungeon = dungeonsById.get(seasonEntry.id);
    if (!dungeon) throw new Error(`missing dungeon record ${seasonEntry.id}`);
    if (dungeon.challengeMapId !== seasonEntry.challengeMapId) throw new Error(`challengeMapId mismatch for ${seasonEntry.id}`);
    if (dungeon.validity?.fromBuild !== season.validity?.fromBuild) throw new Error(`build mismatch for ${seasonEntry.id}`);
    const record = abilitiesByInstance.get(dungeon.instanceMapId);
    if (!record) throw new Error(`missing ability record ${seasonEntry.id}`);
    if (record.validity?.fromBuild !== season.validity?.fromBuild) throw new Error(`ability build mismatch for ${seasonEntry.id}`);

    for (const enemy of record.enemies) {
      for (const ability of enemy.abilities) {
        if (!ability.name?.trim()) throw new Error(`unnamed spell ${ability.spellId} for ${seasonEntry.id}`);
        abilityRowCount += 1;
        const indexed = abilities.get(ability.spellId) ?? { spellId: ability.spellId, name: ability.name, contexts: [] };
        if (indexed.name !== ability.name) throw new Error(`conflicting names for spell ${ability.spellId}`);
        indexed.contexts.push({
          dungeonId: dungeon.id,
          instanceMapId: dungeon.instanceMapId,
          npcId: enemy.npcId,
          npcName: enemy.name,
          interruptible: ability.interruptible,
          dispelType: ability.dispelType,
          enrage: ability.enrage,
        });
        abilities.set(ability.spellId, indexed);
      }
    }
  }

  const normalized = [...abilities.values()].sort((left, right) => left.spellId - right.spellId).map((ability) => {
    ability.contexts.sort((left, right) => left.dungeonId.localeCompare(right.dungeonId) || left.npcId - right.npcId);
    return { spellId: ability.spellId, name: ability.name, responseTags: deriveResponseTags(ability.contexts), contexts: ability.contexts };
  });
  for (const ability of normalized) {
    if (!ability.responseTags.length) throw new Error(`spell ${ability.spellId} has no actionable response tag`);
  }

  return {
    $schema: "../../schemas/ability-index.schema.json",
    schemaVersion: 1,
    recordType: "ability-index",
    id: `${season.id}/flagged-abilities`,
    status: "draft",
    validity: { ...season.validity },
    seasonSlug: season.id,
    abilityRowCount,
    abilities: normalized,
    provenance: season.dungeons.map((entry) => ({
      kind: "curated",
      description: `Lossless generated index of flagged ability facts from ${entry.id}.`,
      recordId: `${entry.id}/enemy-abilities`,
    })),
  };
}
