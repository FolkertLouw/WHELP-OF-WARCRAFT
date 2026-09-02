import { deriveResponseTags } from "./ability-index.mjs";

const knownTags = new Set(["interrupt", "dispel-magic", "cleanse-curse", "cleanse-disease", "cleanse-poison", "soothe"]);

export function queryAbilities(index, filters = {}) {
  if (index?.recordType !== "ability-index") throw new TypeError("index must be a WHELP ability-index record");
  if (filters.tag && !knownTags.has(filters.tag)) throw new Error(`unknown response tag ${filters.tag}`);
  if (filters.spellId !== undefined && (!Number.isInteger(filters.spellId) || filters.spellId < 1)) {
    throw new Error("spellId must be a positive integer");
  }
  const nameNeedle = filters.name?.trim().toLocaleLowerCase("en-US") ?? "";
  const results = [];
  for (const ability of index.abilities) {
    if (filters.spellId !== undefined && ability.spellId !== filters.spellId) continue;
    if (nameNeedle && !ability.name.toLocaleLowerCase("en-US").includes(nameNeedle)) continue;
    const contexts = filters.dungeonId
      ? ability.contexts.filter((context) => context.dungeonId === filters.dungeonId)
      : ability.contexts;
    if (!contexts.length) continue;
    const responseTags = deriveResponseTags(contexts);
    if (filters.tag && !responseTags.includes(filters.tag)) continue;
    results.push({ spellId: ability.spellId, name: ability.name, responseTags, contexts });
  }
  return {
    schemaVersion: 1,
    sourceRecordId: index.id,
    validity: index.validity,
    query: {
      dungeonId: filters.dungeonId ?? null,
      spellId: filters.spellId ?? null,
      name: filters.name ?? null,
      tag: filters.tag ?? null,
    },
    resultCount: results.length,
    results,
  };
}
