import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..", "..");

test("keeps every flagged season ability human-readable and internally consistent", async () => {
  const season = JSON.parse(await readFile(path.join(root, "data", "seasons", "midnight-season-2.json"), "utf8"));
  const index = JSON.parse(await readFile(path.join(root, "data", "index.json"), "utf8"));
  const wanted = new Set(season.dungeons.map((dungeon) => dungeon.id));
  const entries = index.dungeons.filter((entry) => wanted.has(entry.id));
  assert.equal(entries.length, season.dungeons.length);

  const namesBySpellId = new Map();
  let abilityRows = 0;
  for (const entry of entries) {
    const record = JSON.parse(await readFile(path.join(root, "data", entry.enemyAbilities), "utf8"));
    assert.ok(record.provenance.some((source) => source.kind === "external-reference"), `${entry.id} lacks name corroboration`);
    for (const enemy of record.enemies) {
      for (const ability of enemy.abilities) {
        abilityRows += 1;
        assert.match(ability.name ?? "", /\S/, `${entry.id} NPC ${enemy.npcId} spell ${ability.spellId} is unnamed`);
        assert.ok(ability.interruptible || ability.dispelType !== "none" || ability.enrage,
          `${entry.id} NPC ${enemy.npcId} spell ${ability.spellId} is not a flagged ability`);
        const existing = namesBySpellId.get(ability.spellId);
        if (existing) assert.equal(ability.name, existing, `spell ${ability.spellId} has conflicting names`);
        else namesBySpellId.set(ability.spellId, ability.name);
      }
    }
  }
  assert.ok(abilityRows > 0);
});
