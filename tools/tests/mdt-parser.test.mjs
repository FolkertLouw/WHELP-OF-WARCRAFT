import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { parseMdtDungeon } from "../lib/mdt-parser.mjs";

test("extracts normalized dungeon facts from an MDT Lua module", async () => {
  const fixture = path.join(import.meta.dirname, "fixtures", "mdt-dungeon.synthetic.lua");
  const result = parseMdtDungeon(await readFile(fixture, "utf8"));
  assert.equal(result.name, "Synthetic Dungeon");
  assert.equal(result.challengeMapId, 987);
  assert.equal(result.teleportSpellId, 123456);
  assert.deepEqual(result.zoneIds, [1001, 1002]);
  assert.equal(result.enemyForcesTotal, 42);
  assert.deepEqual(result.enemies, [{
    name: "Synthetic Caster",
    npcId: 900001,
    enemyForces: 7,
    sourceEncounterId: 7654,
    sourceInstanceId: 8765,
    spells: [{
      spellId: 800001,
      interruptible: true,
      poison: true,
      disease: false,
      curse: false,
      magic: false,
      enrage: false,
    }],
    clones: [{ cloneIndex: 1, groupId: 9, sublevel: 2, x: 123.5, y: -45.25 }],
  }]);
});
