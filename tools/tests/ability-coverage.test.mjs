import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { compileAbilityIndex } from "../lib/ability-index.mjs";

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

test("keeps the checked-in season ability index reproducible and lossless", async () => {
  const season = JSON.parse(await readFile(path.join(root, "data", "seasons", "midnight-season-2.json"), "utf8"));
  const index = JSON.parse(await readFile(path.join(root, "data", "index.json"), "utf8"));
  const wanted = new Set(season.dungeons.map((dungeon) => dungeon.id));
  const entries = index.dungeons.filter((entry) => wanted.has(entry.id));
  const dungeons = await Promise.all(entries.map((entry) => readFile(path.join(root, "data", entry.record), "utf8").then(JSON.parse)));
  const abilityRecords = await Promise.all(entries.map((entry) => readFile(path.join(root, "data", entry.enemyAbilities), "utf8").then(JSON.parse)));
  const generated = compileAbilityIndex({ season, dungeons, abilityRecords });
  const checkedIn = JSON.parse(await readFile(path.join(root, "data", "abilities", "midnight-season-2.json"), "utf8"));
  assert.deepEqual(checkedIn, generated);
  assert.equal(checkedIn.abilityRowCount, 149);
  assert.equal(checkedIn.abilities.length, 122);
  assert.ok(checkedIn.provenance.every((source) => source.retrievedAt), "generated provenance must carry input freshness timestamps");
});

test("rejects unnamed and conflicting ability evidence during index generation", async () => {
  const season = JSON.parse(await readFile(path.join(root, "data", "seasons", "midnight-season-2.json"), "utf8"));
  const index = JSON.parse(await readFile(path.join(root, "data", "index.json"), "utf8"));
  const wanted = new Set(season.dungeons.map((dungeon) => dungeon.id));
  const entries = index.dungeons.filter((entry) => wanted.has(entry.id));
  const dungeons = await Promise.all(entries.map((entry) => readFile(path.join(root, "data", entry.record), "utf8").then(JSON.parse)));
  const abilityRecords = await Promise.all(entries.map((entry) => readFile(path.join(root, "data", entry.enemyAbilities), "utf8").then(JSON.parse)));

  const unnamed = structuredClone(abilityRecords);
  unnamed[0].enemies[0].abilities[0].name = null;
  assert.throws(() => compileAbilityIndex({ season, dungeons, abilityRecords: unnamed }), /unnamed spell/);

  const conflicting = structuredClone(abilityRecords);
  const occurrences = conflicting.flatMap((record) => record.enemies.flatMap((enemy) => enemy.abilities))
    .filter((ability) => ability.spellId === 1307567);
  assert.ok(occurrences.length > 1);
  occurrences[1].name = "Conflicting Name";
  assert.throws(() => compileAbilityIndex({ season, dungeons, abilityRecords: conflicting }), /conflicting names/);
});
