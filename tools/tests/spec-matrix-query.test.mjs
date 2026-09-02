import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { loadSpecCapabilities, loadSpecDungeonMatrices } from "../lib/load-query-data.mjs";
import { querySpecMatrix } from "../lib/spec-matrix-query.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const matrices = await loadSpecDungeonMatrices(root);
const capabilities = await loadSpecCapabilities(root);

test("joins a dungeon matrix to exact modeled tools and mechanics", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "blood-death-knight", dungeon: "ruby-life-pools" });
  assert.equal(report.sourceRecordId, "midnight-season-2/blood-death-knight-utility-matrix");
  assert.equal(report.dungeons.length, 1);
  assert.deepEqual(report.dungeons[0].mechanicSpellIds, [372743, 372858]);
  const reposition = report.dungeons[0].utilities.find((entry) => entry.axisId === "enemy-reposition");
  assert.deepEqual(reposition.tools.map((tool) => tool.id), ["death-grip", "gorefiends-grasp"]);
});

test("filters utility ratings without discarding dungeon evidence", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "frost-death-knight", dungeon: "kings-rest", rating: "always" });
  assert.ok(report.dungeons[0].utilities.every((entry) => entry.rating === "always"));
  assert.ok(report.dungeons[0].utilities.some((entry) => entry.axisId === "control-undead"));
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(1303267));
});

test("returns one requested affix with provenance", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "unholy-death-knight", affix: "xalataths-bargain-devour" });
  assert.equal(report.affixes.length, 1);
  assert.match(report.affixes[0].recommendations.join(" "), /Anti-Magic Shell/);
  assert.ok(report.provenance.length > 0);
});

test("rejects absent matrices and invalid filters explicitly", () => {
  assert.throws(() => querySpecMatrix(matrices, capabilities, { spec: "arcane-mage" }), /has no seasonal utility matrix/);
  assert.throws(() => querySpecMatrix(matrices, capabilities, { spec: "frost-death-knight", dungeon: "not-a-dungeon" }), /has no dungeon/);
  assert.throws(() => querySpecMatrix(matrices, capabilities, { spec: "frost-death-knight", rating: "best" }), /unknown utility rating/);
});

test("surfaces action-level talent availability for Restoration Shaman", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "restoration-shaman", dungeon: "den-of-nalorakk" });
  const purify = report.dungeons[0].utilities.find((entry) => entry.axisId === "improved-purify-spirit").tools[0];
  assert.deepEqual(purify.actions, ["cleanse-magic", "cleanse-curse"]);
  assert.equal(purify.availability, "specialization");
  assert.equal(purify.availabilityByAction["cleanse-curse"], "talent");
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(1238801));
});

test("returns Enhancement Shaman's exact snare-removal options", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "enhancement-shaman", dungeon: "altar-of-fangs", rating: "always" });
  const snare = report.dungeons[0].utilities.find((entry) => entry.axisId === "snare-removal");
  assert.deepEqual(snare.tools.map((tool) => tool.id), ["thunderous-paws", "spirit-walk", "wind-rush-totem"]);
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(1294569));
});

test("joins Beast Mastery target manipulation to the exact dungeon evidence", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "beast-mastery-hunter", dungeon: "ruby-life-pools", rating: "always" });
  const targetDrop = report.dungeons[0].utilities.find((entry) => entry.axisId === "target-drop");
  assert.deepEqual(targetDrop.tools.map((tool) => tool.id), ["feign-death"]);
  assert.deepEqual(targetDrop.tools[0].actions, ["target-drop"]);
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(391031));
});

test("joins Marksmanship self-cleanse without claiming group dispel coverage", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "marksmanship-hunter", dungeon: "voidscar-arena", rating: "always" });
  const cleanse = report.dungeons[0].utilities.find((entry) => entry.axisId === "self-cleanse").tools[0];
  assert.equal(cleanse.id, "emergency-salve");
  assert.deepEqual(cleanse.actions, ["cleanse-disease", "cleanse-poison"]);
  assert.match(cleanse.limitations.join(" "), /Self-only/);
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(1263971));
});
