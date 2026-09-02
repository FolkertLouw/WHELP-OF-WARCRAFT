import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..", "..");
const loadJson = async (...segments) => JSON.parse(await readFile(path.join(root, ...segments), "utf8"));
const matrix = await loadJson("content", "mythic-plus", "midnight-season-2", "specs", "unholy-death-knight-utility-matrix.json");
const capabilities = await loadJson("data", "specs", "death-knight", "unholy.json");
const season = await loadJson("data", "seasons", "midnight-season-2.json");

test("Unholy matrix covers every Midnight Season 2 dungeon exactly once", () => {
  assert.deepEqual(
    new Set(matrix.dungeons.map((entry) => entry.dungeonId)),
    new Set(season.dungeons.map((entry) => entry.id)),
  );
  assert.equal(matrix.dungeons.length, season.dungeons.length);
});

test("Unholy matrix axes resolve to modeled spec tools", () => {
  const tools = new Map(capabilities.tools.map((tool) => [tool.id, tool]));
  for (const axis of matrix.axes) {
    for (const toolId of axis.toolIds) {
      const tool = tools.get(toolId);
      assert.ok(tool, `${axis.id} should resolve ${toolId}`);
      assert.ok(axis.abilityNames.includes(tool.name));
      assert.ok(axis.spellIds.includes(tool.spellId));
    }
  }
});

test("Unholy matrix separates forced movement immunity from root removal", () => {
  const axis = matrix.axes.find((entry) => entry.id === "movement-control");
  assert.deepEqual(axis.toolIds, ["deaths-advance", "wraith-walk"]);
  const vale = matrix.dungeons.find((entry) => entry.dungeonId === "the-blinding-vale");
  assert.match(vale.notes.join(" "), /Wraith Walk is the recovery option/);
  assert.match(vale.notes.join(" "), /Death's Advance does not remove it/);
});

test("Unholy matrix does not mislabel Death Grip as an interrupt", () => {
  const grip = capabilities.tools.find((tool) => tool.id === "death-grip");
  assert.deepEqual(grip.actions, ["enemy-reposition"]);
  assert.match(matrix.dungeons.find((entry) => entry.dungeonId === "voidscar-arena").notes.join(" "), /not as a normal spell-school interrupt/);
});
