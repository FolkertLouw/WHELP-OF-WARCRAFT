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
  const withoutMatrix = capabilities.map((record) => record.spec.slug === "balance-druid" ? { ...record, matrixRecordId: undefined } : record);
  assert.throws(() => querySpecMatrix(matrices, withoutMatrix, { spec: "balance-druid" }), /has no seasonal utility matrix/);
  assert.throws(() => querySpecMatrix(matrices, capabilities, { spec: "frost-death-knight", dungeon: "not-a-dungeon" }), /has no dungeon/);
  assert.throws(() => querySpecMatrix(matrices, capabilities, { spec: "frost-death-knight", rating: "best" }), /unknown utility rating/);
});

test("joins Arcane Mage decurse without treating self movement tools as party coverage", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "arcane-mage", dungeon: "den-of-nalorakk", rating: "always" });
  const decurse = report.dungeons[0].utilities.find((entry) => entry.axisId === "decurse");
  assert.equal(decurse.tools[0].id, "remove-curse");
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(1238801));
  assert.ok(!report.dungeons[0].utilities.some((entry) => entry.axisId === "snare-removal"));
});

test("joins Frost Mage control to the exact Voidscar mechanic", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "frost-mage", dungeon: "voidscar-arena", rating: "always" });
  const control = report.dungeons[0].utilities.find((entry) => entry.axisId === "control");
  assert.ok(control.tools.some((tool) => tool.id === "polymorph"));
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(1263971));
});

test("joins Protection Paladin toxin removal without claiming Magic cleansing", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "protection-paladin", dungeon: "murder-row", rating: "always" });
  const cleanse = report.dungeons[0].utilities.find((entry) => entry.axisId === "toxin-cleanse").tools[0];
  assert.deepEqual(cleanse.actions, ["cleanse-poison", "cleanse-disease"]);
  assert.match(cleanse.limitations.join(" "), /Does not remove harmful Magic/);
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(1216590));
});

test("joins Retribution physical immunity to exact King's Rest mechanics", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "retribution-paladin", dungeon: "kings-rest", rating: "always" });
  const immunity = report.dungeons[0].utilities.find((entry) => entry.axisId === "physical-immunity");
  assert.equal(immunity.tools[0].id, "blessing-of-protection");
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(267494));
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(1303490));
});

test("joins Holy Paladin Magic cleansing without extending it to non-healer specs", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "holy-paladin", dungeon: "murder-row", rating: "always" });
  const cleanse = report.dungeons[0].utilities.find((entry) => entry.axisId === "magic-toxin-cleanse").tools[0];
  assert.equal(cleanse.id, "cleanse");
  assert.ok(cleanse.actions.includes("cleanse-magic"));
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(1201554));
});

test("joins Holy Paladin Physical immunity to canonical Severing Axe", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "holy-paladin", dungeon: "kings-rest", rating: "always" });
  const immunity = report.dungeons[0].utilities.find((entry) => entry.axisId === "physical-immunity");
  assert.equal(immunity.tools[0].id, "blessing-of-protection");
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(266231));
});

test("joins Discipline Priest mixed dispels and self-only Phantasm without conflation", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "discipline-priest", dungeon: "kings-rest", rating: "always" });
  const purge = report.dungeons[0].utilities.find((entry) => entry.axisId === "enemy-magic-removal");
  assert.deepEqual(purge.tools.map((tool) => tool.id), ["dispel-magic", "mass-dispel"]);
  const phantasm = report.dungeons[0].utilities.find((entry) => entry.axisId === "self-snare-removal").tools[0];
  assert.equal(phantasm.scope, "self");
  assert.deepEqual(phantasm.actions, ["cleanse-snare"]);
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(269935));
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(270499));
});

test("joins Holy Priest healer dispels and route utility with explicit scopes", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "holy-priest", dungeon: "altar-of-fangs", rating: "always" });
  const magic = report.dungeons[0].utilities.find((entry) => entry.axisId === "friendly-magic-removal");
  assert.deepEqual(magic.tools.map((tool) => tool.id), ["purify", "mass-dispel"]);
  assert.equal(magic.tools.find((tool) => tool.id === "mass-dispel").scope, "mixed-area");
  const disease = report.dungeons[0].utilities.find((entry) => entry.axisId === "disease-cleanse");
  assert.equal(disease.tools[0].availabilityByAction["cleanse-disease"], "talent");
});

test("joins Shadow Priest offensive dispels without claiming Dominate Mind on Undead", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "shadow-priest", dungeon: "kings-rest", rating: "always" });
  const purge = report.dungeons[0].utilities.find((entry) => entry.axisId === "enemy-magic-removal");
  assert.deepEqual(purge.tools.map((tool) => tool.id), ["dispel-magic", "mass-dispel"]);
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(269935));
  assert.ok(!report.dungeons[0].utilities.some((entry) => entry.axisId === "mind-control"));
});

test("joins Shadow Dispersion only as self movement freedom", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "shadow-priest", dungeon: "the-blinding-vale", rating: "always" });
  const movement = report.dungeons[0].utilities.find((entry) => entry.axisId === "self-movement-freedom").tools[0];
  assert.equal(movement.id, "dispersion");
  assert.equal(movement.scope, "self");
  assert.ok(movement.actions.includes("cleanse-root"));
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

test("joins Survival's Murder Row-only stealth revelation", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "survival-hunter", dungeon: "murder-row", rating: "always" });
  const reveal = report.dungeons[0].utilities.find((entry) => entry.axisId === "reveal-stealth");
  assert.equal(reveal.tools[0].id, "flare");
  assert.deepEqual(reveal.tools[0].actions, ["reveal-stealth"]);
  assert.ok(report.dungeons[0].mechanicSpellIds.includes(1216970));
});

test("joins Feral shapeshifting as self-only removal and preserves Soothe cautions", () => {
  const vale = querySpecMatrix(matrices, capabilities, { spec: "feral-druid", dungeon: "the-blinding-vale", rating: "always" });
  const shapeshift = vale.dungeons[0].utilities.find((entry) => entry.axisId === "self-shapeshift-cleanse").tools[0];
  assert.equal(shapeshift.id, "cat-form");
  assert.equal(shapeshift.scope, "self");
  assert.deepEqual(shapeshift.actions, ["cleanse-snare", "cleanse-root"]);
  const kingsRest = querySpecMatrix(matrices, capabilities, { spec: "feral-druid", dungeon: "kings-rest" });
  assert.match(kingsRest.dungeons[0].notes.join(" "), /Do not Soothe Ancestral Fury/);
});

test("keeps Restoration Druid healer cleansing distinct from DPS Druid cleansing", () => {
  const resto = querySpecMatrix(matrices, capabilities, { spec: "restoration-druid", dungeon: "murder-row", rating: "always" });
  assert.ok(resto.dungeons[0].utilities.find((entry) => entry.axisId === "magic-toxin-cleanse").tools[0].actions.includes("cleanse-magic"));
  const balance = querySpecMatrix(matrices, capabilities, { spec: "balance-druid", dungeon: "murder-row", rating: "always" });
  assert.ok(!balance.dungeons[0].utilities.find((entry) => entry.axisId === "toxin-curse-cleanse").tools[0].actions.includes("cleanse-magic"));
});

test("surfaces Guardian positional stops without calling them school interrupts", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "guardian-druid", dungeon: "altar-of-fangs", rating: "always" });
  const control = report.dungeons[0].utilities.find((entry) => entry.axisId === "area-control");
  assert.ok(control.tools.find((tool) => tool.id === "typhoon").actions.includes("enemy-reposition"));
  assert.match(report.dungeons[0].notes.join(" "), /not spell-school lockouts/);
});

test("joins Warrior matrices to dedicated reflection and party-health semantics", () => {
  const arms = querySpecMatrix(matrices, capabilities, { spec: "arms-warrior", dungeon: "voidscar-arena", rating: "niche" });
  const reflection = arms.dungeons[0].utilities.find((entry) => entry.axisId === "spell-reflection").tools[0];
  assert.deepEqual(reflection.actions, ["defensive", "spell-reflection"]);
  assert.equal(reflection.scope, "self");
  const protection = querySpecMatrix(matrices, capabilities, { spec: "protection-warrior", dungeon: "altar-of-fangs", rating: "always" });
  const interrupt = protection.dungeons[0].utilities.find((entry) => entry.axisId === "interrupt");
  assert.deepEqual(interrupt.tools.map((tool) => tool.id), ["pummel", "disrupting-shout"]);
  const rally = protection.dungeons[0].utilities.find((entry) => entry.axisId === "party-health-increase").tools[0];
  assert.deepEqual(rally.actions, ["party-health-increase"]);
});

test("does not promote Warrior self cleansing to party coverage or root removal", () => {
  const vale = querySpecMatrix(matrices, capabilities, { spec: "fury-warrior", dungeon: "the-blinding-vale" });
  const cleanse = vale.dungeons[0].utilities.find((entry) => entry.axisId === "self-toxin-curse-cleanse").tools[0];
  assert.equal(cleanse.scope, "self");
  assert.ok(!cleanse.actions.includes("cleanse-magic"));
  const rage = vale.dungeons[0].utilities.find((entry) => entry.axisId === "self-fear-snare-removal").tools[0];
  assert.ok(!rage.actions.includes("cleanse-root"));
  assert.match(vale.dungeons[0].notes.join(" "), /not Bloodthorn Roots/);
});

test("joins Rogue route stealth without treating it as invisibility or universal skip coverage", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "subtlety-rogue", dungeon: "kings-rest", rating: "niche" });
  const shroud = report.dungeons[0].utilities.find((entry) => entry.axisId === "route-stealth").tools[0];
  assert.equal(shroud.scope, "friendly-area");
  assert.match(shroud.limitations.join(" "), /stealth, not invisibility/);
  assert.match(report.dungeons[0].notes.join(" "), /route-planning utility/);
});

test("preserves Rogue Enrage and single-target stop boundaries", () => {
  const den = querySpecMatrix(matrices, capabilities, { spec: "assassination-rogue", dungeon: "den-of-nalorakk", rating: "always" });
  assert.equal(den.dungeons[0].utilities.find((entry) => entry.axisId === "soothe").tools[0].id, "shiv");
  const control = den.dungeons[0].utilities.find((entry) => entry.axisId === "single-target-control");
  assert.deepEqual(control.tools.map((tool) => tool.id), ["blind", "kidney-shot"]);
  assert.ok(control.tools.every((tool) => !tool.actions.includes("interrupt")));
});

test("does not turn Vanish mechanic cancellation into a generic dispel", () => {
  const report = querySpecMatrix(matrices, capabilities, { spec: "outlaw-rogue", dungeon: "the-blinding-vale", rating: "always" });
  const vanish = report.dungeons[0].utilities.find((entry) => entry.axisId === "target-cancellation").tools[0];
  assert.deepEqual(vanish.actions, ["target-drop"]);
  assert.ok(!vanish.actions.includes("cleanse-magic"));
  assert.ok(!vanish.actions.includes("cleanse-root"));
});
