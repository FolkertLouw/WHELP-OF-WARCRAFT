import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..", "..");
const loadJson = async (...segments) => JSON.parse(await readFile(path.join(root, ...segments), "utf8"));
const matrix = await loadJson("content", "mythic-plus", "midnight-season-2", "specs", "unholy-death-knight-utility-matrix.json");
const capabilities = await loadJson("data", "specs", "death-knight", "unholy.json");
const frostMatrix = await loadJson("content", "mythic-plus", "midnight-season-2", "specs", "frost-death-knight-utility-matrix.json");
const frostCapabilities = await loadJson("data", "specs", "death-knight", "frost.json");
const bloodMatrix = await loadJson("content", "mythic-plus", "midnight-season-2", "specs", "blood-death-knight-utility-matrix.json");
const bloodCapabilities = await loadJson("data", "specs", "death-knight", "blood.json");
const restorationMatrix = await loadJson("content", "mythic-plus", "midnight-season-2", "specs", "restoration-shaman-utility-matrix.json");
const restorationCapabilities = await loadJson("data", "specs", "shaman", "restoration.json");
const enhancementMatrix = await loadJson("content", "mythic-plus", "midnight-season-2", "specs", "enhancement-shaman-utility-matrix.json");
const enhancementCapabilities = await loadJson("data", "specs", "shaman", "enhancement.json");
const beastMasteryMatrix = await loadJson("content", "mythic-plus", "midnight-season-2", "specs", "beast-mastery-hunter-utility-matrix.json");
const beastMasteryCapabilities = await loadJson("data", "specs", "hunter", "beast-mastery.json");
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

test("Frost matrix covers the season and resolves every modeled utility axis", () => {
  assert.deepEqual(new Set(frostMatrix.dungeons.map((entry) => entry.dungeonId)), new Set(season.dungeons.map((entry) => entry.id)));
  const tools = new Map(frostCapabilities.tools.map((tool) => [tool.id, tool]));
  for (const axis of frostMatrix.axes) {
    for (const toolId of axis.toolIds) assert.ok(tools.has(toolId), `${axis.id} should resolve ${toolId}`);
  }
});

test("Frost matrix limits Control Undead to its sourced King's Rest niche", () => {
  for (const dungeon of frostMatrix.dungeons) {
    assert.equal(dungeon.ratings["control-undead"], dungeon.dungeonId === "kings-rest" ? "always" : "none");
  }
});

test("Frost matrix preserves the unresolved Ruby Life Pools spell-ID caveat", () => {
  const ruby = frostMatrix.dungeons.find((entry) => entry.dungeonId === "ruby-life-pools");
  assert.deepEqual(ruby.mechanicSpellIds, []);
  assert.match(ruby.notes.join(" "), /no spell ID is asserted/);
});

test("Blood matrix covers the season and resolves tank-specific tools", () => {
  assert.deepEqual(new Set(bloodMatrix.dungeons.map((entry) => entry.dungeonId)), new Set(season.dungeons.map((entry) => entry.id)));
  const tools = new Map(bloodCapabilities.tools.map((tool) => [tool.id, tool]));
  for (const axis of bloodMatrix.axes) {
    for (const toolId of axis.toolIds) assert.ok(tools.has(toolId), `${axis.id} should resolve ${toolId}`);
  }
  assert.ok(tools.has("gorefiends-grasp"));
  assert.ok(tools.has("death-strike"));
});

test("Blood affix advice does not incorrectly pre-immune Devour", () => {
  const devour = bloodMatrix.affixes.find((entry) => entry.affixSlug === "xalataths-bargain-devour");
  assert.match(devour.recommendations.join(" "), /Do not pre-immune/);
  assert.match(devour.recommendations.join(" "), /Death Strike/);
});

test("Blood matrix keeps positional grip stops distinct from school lockouts", () => {
  const grip = bloodCapabilities.tools.find((tool) => tool.id === "death-grip");
  assert.deepEqual(grip.actions, ["enemy-reposition"]);
  assert.match(bloodMatrix.dungeons.find((entry) => entry.dungeonId === "murder-row").notes.join(" "), /rather than interrupt coverage/);
});

test("Restoration Shaman matrix covers the season and resolves every utility axis", () => {
  assert.deepEqual(new Set(restorationMatrix.dungeons.map((entry) => entry.dungeonId)), new Set(season.dungeons.map((entry) => entry.id)));
  const tools = new Map(restorationCapabilities.tools.map((tool) => [tool.id, tool]));
  for (const axis of restorationMatrix.axes) {
    for (const toolId of axis.toolIds) {
      const tool = tools.get(toolId);
      assert.ok(tool, `${axis.id} should resolve ${toolId}`);
      assert.ok(axis.abilityNames.includes(tool.name));
      assert.ok(axis.spellIds.includes(tool.spellId));
    }
  }
});

test("Restoration Shaman models Curse removal as talent-dependent", () => {
  const purify = restorationCapabilities.tools.find((tool) => tool.id === "purify-spirit");
  assert.equal(purify.availability, "specialization");
  assert.equal(purify.actionAvailability["cleanse-curse"], "talent");
  assert.match(purify.limitations.join(" "), /Improved Purify Spirit/);
  const tremor = restorationCapabilities.tools.find((tool) => tool.id === "tremor-totem");
  assert.deepEqual(tremor.actions, ["cleanse-fear", "cleanse-charm", "cleanse-sleep"]);
});

test("Enhancement Shaman matrix resolves distinct personal and group snare tools", () => {
  assert.deepEqual(new Set(enhancementMatrix.dungeons.map((entry) => entry.dungeonId)), new Set(season.dungeons.map((entry) => entry.id)));
  const tools = new Map(enhancementCapabilities.tools.map((tool) => [tool.id, tool]));
  const snare = enhancementMatrix.axes.find((axis) => axis.id === "snare-removal");
  assert.deepEqual(snare.toolIds, ["thunderous-paws", "spirit-walk", "wind-rush-totem"]);
  for (const toolId of snare.toolIds) {
    assert.ok(tools.has(toolId));
    assert.ok(tools.get(toolId).actions.includes("cleanse-snare"));
  }
  assert.match(tools.get("wind-rush-totem").limitations.join(" "), /Jet Stream/);
});

test("Beast Mastery Hunter matrix covers the season and resolves every utility axis", () => {
  assert.deepEqual(new Set(beastMasteryMatrix.dungeons.map((entry) => entry.dungeonId)), new Set(season.dungeons.map((entry) => entry.id)));
  const tools = new Map(beastMasteryCapabilities.tools.map((tool) => [tool.id, tool]));
  for (const axis of beastMasteryMatrix.axes) {
    for (const toolId of axis.toolIds) {
      const tool = tools.get(toolId);
      assert.ok(tool, `${axis.id} should resolve ${toolId}`);
      assert.ok(axis.abilityNames.includes(tool.name));
      assert.ok(axis.spellIds.includes(tool.spellId));
    }
  }
});

test("Beast Mastery keeps target drops, cleanses, and enemy removal distinct", () => {
  const tools = new Map(beastMasteryCapabilities.tools.map((tool) => [tool.id, tool]));
  assert.deepEqual(tools.get("feign-death").actions, ["target-drop"]);
  assert.deepEqual(tools.get("emergency-salve").actions, ["cleanse-disease", "cleanse-poison"]);
  assert.deepEqual(tools.get("tranquilizing-shot").actions, ["purge", "soothe"]);
  assert.match(beastMasteryMatrix.dungeons.find((entry) => entry.dungeonId === "altar-of-fangs").notes.join(" "), /not a general interrupt/);
});
