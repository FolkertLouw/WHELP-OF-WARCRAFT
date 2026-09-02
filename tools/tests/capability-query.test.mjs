import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { queryCapabilities } from "../lib/capability-query.mjs";
import { loadSpecCapabilities, loadSpecCapabilityCoverage } from "../lib/load-query-data.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const capabilities = await loadSpecCapabilities(root);
const coverage = await loadSpecCapabilityCoverage(root);

test("declares the current capability catalog partial and covers every loaded record", () => {
  assert.equal(coverage.isComplete, false);
  assert.equal(coverage.entries.length, capabilities.length);
  assert.deepEqual(new Set(coverage.entries.map((entry) => entry.recordId)), new Set(capabilities.map((record) => record.id)));
  assert.match(coverage.missingDataMeaning, /not yet modeled/);
});

test("queries composition utility across selected specializations", () => {
  const result = queryCapabilities(capabilities, {
    specs: ["holy-paladin", "protection-paladin", "retribution-paladin"],
    action: "battle-resurrection"
  });
  assert.equal(result.resultCount, 3);
  assert.ok(result.results.every((entry) => entry.tool.name === "Intercession"));
  assert.ok(result.results.every((entry) => entry.tool.availabilityByAction["battle-resurrection"] === "baseline"));
});

test("preserves per-action talent requirements", () => {
  const magic = queryCapabilities(capabilities, { specs: ["holy-paladin"], action: "cleanse-magic" });
  const poison = queryCapabilities(capabilities, { specs: ["holy-paladin"], action: "cleanse-poison" });
  assert.equal(magic.results[0].tool.availabilityByAction["cleanse-magic"], "specialization");
  assert.equal(poison.results[0].tool.availabilityByAction["cleanse-poison"], "talent");
});

test("distinguishes unconditional and configuration-dependent Bloodlust access", () => {
  const result = queryCapabilities(capabilities, {
    specs: ["restoration-shaman", "beast-mastery-hunter", "marksmanship-hunter"],
    action: "bloodlust"
  });
  assert.equal(result.resultCount, 3);
  const shaman = result.results.find((entry) => entry.spec.slug === "restoration-shaman");
  const beastMastery = result.results.find((entry) => entry.spec.slug === "beast-mastery-hunter");
  const marksmanship = result.results.find((entry) => entry.spec.slug === "marksmanship-hunter");
  assert.deepEqual(shaman.tool.alternateSpellIds, [32182]);
  assert.deepEqual(beastMastery.tool.requirements, [{ kind: "pet-specialization", value: "Ferocity" }]);
  assert.deepEqual(marksmanship.tool.requirements, []);
  assert.equal(marksmanship.tool.availabilityByAction.bloodlust, "specialization");
});

test("queries shared Druid group buffs and combat resurrection", () => {
  const specs = ["balance-druid", "feral-druid", "guardian-druid", "restoration-druid"];
  const buffs = queryCapabilities(capabilities, { specs, action: "group-buff" });
  const resurrections = queryCapabilities(capabilities, { specs, action: "battle-resurrection" });
  assert.equal(buffs.resultCount, 4);
  assert.equal(resurrections.resultCount, 4);
  assert.ok(buffs.results.every((entry) => entry.tool.name === "Mark of the Wild"));
  assert.ok(resurrections.results.every((entry) => entry.tool.name === "Rebirth"));
});

test("distinguishes Priest healer dispels from Shadow dispels", () => {
  const healerMagic = queryCapabilities(capabilities, { specs: ["discipline-priest", "holy-priest"], action: "cleanse-magic" });
  const shadowMagic = queryCapabilities(capabilities, { specs: ["shadow-priest"], action: "cleanse-magic" });
  const disease = queryCapabilities(capabilities, { specs: ["discipline-priest", "holy-priest", "shadow-priest"], action: "cleanse-disease" });
  assert.ok(healerMagic.results.some((entry) => entry.tool.name === "Purify"));
  assert.equal(shadowMagic.resultCount, 1);
  assert.equal(shadowMagic.results[0].tool.name, "Mass Dispel");
  assert.equal(shadowMagic.results[0].tool.scope, "mixed-area");
  assert.equal(disease.resultCount, 3);
  assert.equal(disease.results.find((entry) => entry.spec.slug === "shadow-priest").tool.name, "Purify Disease");
});

test("models Mass Dispel as mixed friendly and enemy area utility", () => {
  const cleanses = queryCapabilities(capabilities, { specs: ["discipline-priest", "holy-priest", "shadow-priest"], action: "cleanse-magic", scope: "mixed-area" });
  const purges = queryCapabilities(capabilities, { specs: ["discipline-priest", "holy-priest", "shadow-priest"], action: "purge", scope: "mixed-area" });
  assert.equal(cleanses.resultCount, 3);
  assert.equal(purges.resultCount, 3);
  assert.ok(cleanses.results.every((entry) => entry.tool.name === "Mass Dispel"));
});

test("preserves Priest interrupt and external cooldown distinctions", () => {
  const interrupts = queryCapabilities(capabilities, { specs: ["discipline-priest", "holy-priest", "shadow-priest"], action: "interrupt" });
  const offensive = queryCapabilities(capabilities, { specs: ["discipline-priest", "holy-priest", "shadow-priest"], action: "external-offensive" });
  assert.equal(interrupts.resultCount, 1);
  assert.equal(interrupts.results[0].spec.slug, "shadow-priest");
  assert.equal(interrupts.results[0].tool.name, "Silence");
  assert.equal(offensive.resultCount, 3);
  assert.ok(offensive.results.every((entry) => entry.tool.name === "Power Infusion"));
});

test("models Mind Soothe as route detection reduction rather than crowd control", () => {
  const routing = queryCapabilities(capabilities, { specs: ["discipline-priest"], action: "detection-reduction" });
  assert.equal(routing.resultCount, 1);
  assert.equal(routing.results[0].tool.name, "Mind Soothe");
  assert.equal(routing.results[0].tool.scope, "area-enemy");
  assert.match(routing.results[0].tool.limitations.join(" "), /Humanoid and Dragonkin/);
});

test("queries shared Mage composition utility across all specializations", () => {
  const specs = ["arcane-mage", "fire-mage", "frost-mage"];
  const interrupts = queryCapabilities(capabilities, { specs, action: "interrupt" });
  const bloodlust = queryCapabilities(capabilities, { specs, action: "bloodlust" });
  const curses = queryCapabilities(capabilities, { specs, action: "cleanse-curse" });
  const purges = queryCapabilities(capabilities, { specs, action: "purge" });
  assert.equal(interrupts.resultCount, 3);
  assert.equal(bloodlust.resultCount, 3);
  assert.equal(curses.resultCount, 3);
  assert.equal(purges.resultCount, 3);
  assert.ok(bloodlust.results.every((entry) => entry.tool.spellId === 80353));
  assert.ok(curses.results.every((entry) => entry.tool.availabilityByAction["cleanse-curse"] === "talent"));
  assert.ok(purges.results.every((entry) => entry.tool.name === "Spellsteal"));
});

test("preserves Death Knight combat resurrection, magic zone, and displacement distinctions", () => {
  const specs = ["blood-death-knight", "frost-death-knight", "unholy-death-knight"];
  const resurrections = queryCapabilities(capabilities, { specs, action: "battle-resurrection" });
  const zones = queryCapabilities(capabilities, { specs, action: "party-damage-reduction" });
  const grips = queryCapabilities(capabilities, { specs, action: "enemy-reposition" });
  assert.equal(resurrections.resultCount, 3);
  assert.equal(zones.resultCount, 3);
  assert.equal(grips.resultCount, 4);
  assert.ok(resurrections.results.every((entry) => entry.tool.name === "Raise Ally" && entry.tool.availabilityByAction["battle-resurrection"] === "baseline"));
  assert.ok(zones.results.every((entry) => entry.tool.name === "Anti-Magic Zone" && entry.tool.availabilityByAction["party-damage-reduction"] === "talent"));
  assert.equal(grips.results.filter((entry) => entry.tool.name === "Death Grip").length, 3);
  assert.deepEqual(grips.results.find((entry) => entry.tool.name === "Gorefiend's Grasp").spec.slug, "blood-death-knight");
});

test("retains Unholy Control Undead's permanent-pet conflict", () => {
  const control = queryCapabilities(capabilities, { specs: ["unholy-death-knight"], action: "crowd-control" });
  const tool = control.results.find((entry) => entry.tool.name === "Control Undead").tool;
  assert.ok(tool.limitations.some((limitation) => limitation.includes("permanent ghoul")));
});

test("rejects unknown specialization slugs", () => {
  assert.throws(() => queryCapabilities(capabilities, { specs: ["not-a-real-spec"] }), /unknown spec/);
});

test("rejects unknown actions and scopes instead of returning misleading empty reports", () => {
  assert.throws(() => queryCapabilities(capabilities, { action: "battle-rez" }), /unknown capability action/);
  assert.throws(() => queryCapabilities(capabilities, { scope: "the-whole-party" }), /unknown capability scope/);
});
