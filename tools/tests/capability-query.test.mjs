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

test("keeps Druid shapeshifting self-only and positional control distinct", () => {
  const forms = queryCapabilities(capabilities, { specs: ["balance-druid", "feral-druid"], action: "cleanse-root" });
  assert.equal(forms.resultCount, 2);
  assert.ok(forms.results.every((entry) => entry.tool.name === "Cat Form" && entry.tool.scope === "self"));
  const reposition = queryCapabilities(capabilities, { specs: ["balance-druid", "feral-druid", "guardian-druid", "restoration-druid"], action: "enemy-reposition" });
  assert.equal(reposition.resultCount, 8);
});

test("distinguishes Warrior temporary health, reflection, and self-cleanses", () => {
  const specs = ["arms-warrior", "fury-warrior", "protection-warrior"];
  const cries = queryCapabilities(capabilities, { specs, action: "party-health-increase" });
  assert.equal(cries.resultCount, 3);
  assert.ok(cries.results.every((entry) => entry.tool.name === "Rallying Cry"));
  const reflections = queryCapabilities(capabilities, { specs, action: "spell-reflection" });
  assert.equal(reflections.resultCount, 3);
  assert.ok(reflections.results.every((entry) => entry.tool.scope === "self"));
  const cleanses = queryCapabilities(capabilities, { specs, action: "cleanse-poison" });
  assert.equal(cleanses.resultCount, 3);
  assert.ok(cleanses.results.every((entry) => entry.tool.name === "Bitter Immunity" && entry.tool.scope === "self"));
});

test("keeps Protection Warrior area lockout separate from crowd-control stops", () => {
  const interrupts = queryCapabilities(capabilities, { specs: ["arms-warrior", "fury-warrior", "protection-warrior"], action: "interrupt" });
  assert.equal(interrupts.resultCount, 4);
  assert.equal(interrupts.results.filter((entry) => entry.tool.name === "Disrupting Shout").length, 1);
  const control = queryCapabilities(capabilities, { specs: ["protection-warrior"], action: "crowd-control" });
  assert.ok(control.results.every((entry) => entry.tool.name !== "Disrupting Shout"));
});

test("models Rogue route stealth, configured poisons, and threat transfer separately", () => {
  const specs = ["assassination-rogue", "outlaw-rogue", "subtlety-rogue"];
  const shrouds = queryCapabilities(capabilities, { specs, action: "group-stealth" });
  assert.equal(shrouds.resultCount, 3);
  assert.ok(shrouds.results.every((entry) => entry.tool.name === "Shroud of Concealment" && entry.tool.scope === "friendly-area"));
  assert.equal(queryCapabilities(capabilities, { specs, action: "enemy-damage-reduction" }).resultCount, 3);
  assert.equal(queryCapabilities(capabilities, { specs, action: "enemy-output-slow" }).resultCount, 3);
  assert.equal(queryCapabilities(capabilities, { specs, action: "healing-reduction" }).resultCount, 3);
  assert.equal(queryCapabilities(capabilities, { specs, action: "threat-transfer" }).resultCount, 3);
});

test("keeps Rogue cleanse and target-drop coverage self-only", () => {
  const specs = ["assassination-rogue", "outlaw-rogue", "subtlety-rogue"];
  const cloaks = queryCapabilities(capabilities, { specs, action: "cleanse-magic" });
  const vanishes = queryCapabilities(capabilities, { specs, action: "target-drop" });
  assert.equal(cloaks.resultCount, 3);
  assert.equal(vanishes.resultCount, 3);
  assert.ok(cloaks.results.every((entry) => entry.tool.scope === "self"));
  assert.ok(vanishes.results.every((entry) => entry.tool.scope === "self"));
  assert.equal(queryCapabilities(capabilities, { specs, action: "cleanse-root" }).resultCount, 0);
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
  const routing = queryCapabilities(capabilities, { specs: ["discipline-priest", "holy-priest", "shadow-priest"], action: "detection-reduction" });
  assert.equal(routing.resultCount, 3);
  assert.ok(routing.results.every((entry) => entry.tool.name === "Mind Soothe"));
  assert.ok(routing.results.every((entry) => entry.tool.scope === "area-enemy"));
  assert.ok(routing.results.every((entry) => /Humanoid and Dragonkin/.test(entry.tool.limitations.join(" "))));
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

test("preserves Monk specialization Detox domains", () => {
  const damageSpecs = ["brewmaster-monk", "windwalker-monk"];
  const toxin = queryCapabilities(capabilities, { specs: damageSpecs, action: "cleanse-poison" });
  const damageMagic = queryCapabilities(capabilities, { specs: damageSpecs, action: "cleanse-magic" });
  const mistMagic = queryCapabilities(capabilities, { specs: ["mistweaver-monk"], action: "cleanse-magic" });
  const mistDisease = queryCapabilities(capabilities, { specs: ["mistweaver-monk"], action: "cleanse-disease" });
  assert.equal(toxin.resultCount, 2);
  assert.equal(damageMagic.resultCount, 2);
  assert.ok(damageMagic.results.every((entry) => entry.tool.id === "diffuse-magic" && entry.tool.scope === "self"));
  assert.ok(mistMagic.results.some((entry) => entry.tool.id === "detox" && entry.tool.scope === "friendly-single"));
  assert.equal(mistDisease.results.find((entry) => entry.tool.id === "detox").tool.availabilityByAction["cleanse-disease"], "talent");
});

test("models Monk ally movement separately from self-only removals", () => {
  const specs = ["brewmaster-monk", "mistweaver-monk", "windwalker-monk"];
  const movement = queryCapabilities(capabilities, { specs, action: "external-movement" });
  const roots = queryCapabilities(capabilities, { specs, action: "cleanse-root" });
  const selfSnares = queryCapabilities(capabilities, { specs, action: "cleanse-snare", scope: "self" });
  assert.equal(movement.resultCount, 3);
  assert.ok(movement.results.every((entry) => entry.tool.id === "tigers-lust" && entry.tool.scope === "friendly-single"));
  assert.equal(roots.resultCount, 3);
  assert.ok(roots.results.every((entry) => entry.tool.id === "tigers-lust"));
  assert.ok(selfSnares.results.every((entry) => entry.tool.id === "swift-art"));
});

test("keeps Mistweaver interrupt absence and Ring of Peace displacement explicit", () => {
  const specs = ["brewmaster-monk", "mistweaver-monk", "windwalker-monk"];
  const interrupts = queryCapabilities(capabilities, { specs, action: "interrupt" });
  const displacement = queryCapabilities(capabilities, { specs, action: "enemy-reposition" });
  assert.deepEqual(interrupts.results.map((entry) => entry.spec.slug).sort(), ["brewmaster-monk", "windwalker-monk"]);
  assert.ok(interrupts.results.every((entry) => entry.tool.id === "spear-hand-strike"));
  assert.equal(displacement.resultCount, 3);
  assert.ok(displacement.results.every((entry) => entry.tool.id === "ring-of-peace"));
});

test("models the complete Shaman composition layer without widening dispel domains", () => {
  const specs = ["elemental-shaman", "enhancement-shaman", "restoration-shaman"];
  assert.equal(queryCapabilities(capabilities, { specs, action: "bloodlust" }).resultCount, 3);
  const buffs = queryCapabilities(capabilities, { specs, action: "group-buff" });
  assert.equal(buffs.resultCount, 3);
  assert.ok(buffs.results.every((entry) => entry.tool.id === "skyfury"));
  const curses = queryCapabilities(capabilities, { specs, action: "cleanse-curse" });
  assert.equal(curses.resultCount, 3);
  const friendlyMagic = queryCapabilities(capabilities, { specs, action: "cleanse-magic", scope: "friendly-single" });
  assert.equal(friendlyMagic.resultCount, 1);
  assert.equal(friendlyMagic.results[0].spec.slug, "restoration-shaman");
  const displacement = queryCapabilities(capabilities, { specs, action: "enemy-reposition" });
  assert.equal(displacement.resultCount, 1);
  assert.equal(displacement.results[0].tool.id, "thunderstorm");
});

test("types Shaman group movement and movement-effect removal separately", () => {
  const specs = ["elemental-shaman", "enhancement-shaman"];
  const movement = queryCapabilities(capabilities, { specs, action: "group-movement" });
  assert.equal(movement.resultCount, 2);
  assert.ok(movement.results.every((entry) => entry.tool.id === "wind-rush-totem"));
  const roots = queryCapabilities(capabilities, { specs, action: "cleanse-root" });
  assert.equal(roots.resultCount, 2);
  assert.ok(roots.results.every((entry) => entry.tool.id === "spirit-walk" && entry.tool.scope === "self"));
});

test("models shared Warlock composition tools and preserves pet configuration", () => {
  const specs = ["affliction-warlock", "demonology-warlock", "destruction-warlock"];
  const stones = queryCapabilities(capabilities, { specs, action: "group-consumable" });
  const gateways = queryCapabilities(capabilities, { specs, action: "group-movement" });
  const resurrections = queryCapabilities(capabilities, { specs, action: "battle-resurrection" });
  const interrupts = queryCapabilities(capabilities, { specs, action: "interrupt" });
  assert.equal(stones.resultCount, 3);
  assert.equal(gateways.resultCount, 3);
  assert.equal(resurrections.resultCount, 3);
  assert.equal(interrupts.resultCount, 3);
  assert.ok(stones.results.every((entry) => entry.tool.name === "Create Soulwell"));
  assert.ok(gateways.results.every((entry) => entry.tool.name === "Demonic Gateway"));
  assert.ok(gateways.results.every((entry) => entry.tool.availabilityByAction["group-movement"] === "talent"));
  assert.ok(interrupts.results.every((entry) => entry.tool.requirements.some((requirement) => requirement.kind === "configuration")));
});

test("does not turn Demonology Fel Ravager or Axe Toss into school-lockout coverage", () => {
  const purges = queryCapabilities(capabilities, { specs: ["demonology-warlock"], action: "purge" });
  assert.ok(purges.results.some((entry) => entry.tool.id === "grimoire-fel-ravager"));
  const control = queryCapabilities(capabilities, { specs: ["demonology-warlock"], action: "crowd-control" });
  const axe = control.results.find((entry) => entry.tool.id === "axe-toss").tool;
  assert.ok(!axe.actions.includes("interrupt"));
  assert.match(axe.limitations.join(" "), /school lockout/);
});

test("models Chaos Brand as a hostile damage-taken debuff across all Demon Hunter specs", () => {
  const specs = ["havoc-demon-hunter", "vengeance-demon-hunter", "devourer-demon-hunter"];
  const brands = queryCapabilities(capabilities, { specs, action: "enemy-damage-taken-increase", scope: "enemy" });
  assert.equal(brands.resultCount, 3);
  assert.ok(brands.results.every((entry) => entry.tool.id === "chaos-brand" && entry.tool.spellId === 255260));
  assert.equal(queryCapabilities(capabilities, { specs, action: "group-buff" }).resultCount, 0);
});

test("keeps Demon Hunter disease and curse removal self-only", () => {
  const specs = ["havoc-demon-hunter", "vengeance-demon-hunter", "devourer-demon-hunter"];
  for (const action of ["cleanse-disease", "cleanse-curse"]) {
    const cleanses = queryCapabilities(capabilities, { specs, action });
    assert.equal(cleanses.resultCount, 3);
    assert.ok(cleanses.results.every((entry) => entry.tool.scope === "self"));
  }
  assert.equal(queryCapabilities(capabilities, { specs, action: "cleanse-root" }).resultCount, 0);
  assert.equal(queryCapabilities(capabilities, { specs, action: "cleanse-magic", scope: "friendly-single" }).resultCount, 0);
});

test("preserves Vengeance area utility and current Fiery Brand semantics", () => {
  const interrupts = queryCapabilities(capabilities, { specs: ["vengeance-demon-hunter"], action: "interrupt" });
  assert.deepEqual(interrupts.results.map((entry) => entry.tool.id).sort(), ["disrupt", "sigil-of-silence"]);
  const reposition = queryCapabilities(capabilities, { specs: ["vengeance-demon-hunter"], action: "enemy-reposition" });
  assert.deepEqual(reposition.results.map((entry) => entry.tool.id), ["sigil-of-chains"]);
  const defensive = queryCapabilities(capabilities, { specs: ["vengeance-demon-hunter"], action: "defensive" });
  const fieryBrand = defensive.results.find((entry) => entry.tool.id === "fiery-brand").tool;
  assert.equal(fieryBrand.scope, "self");
  assert.ok(!fieryBrand.actions.includes("enemy-damage-reduction"));
  const devourerInterrupts = queryCapabilities(capabilities, { specs: ["devourer-demon-hunter"], action: "interrupt" });
  assert.deepEqual(devourerInterrupts.results.map((entry) => entry.tool.id), ["disrupt"]);
});

test("rejects unknown actions and scopes instead of returning misleading empty reports", () => {
  assert.throws(() => queryCapabilities(capabilities, { action: "battle-rez" }), /unknown capability action/);
  assert.throws(() => queryCapabilities(capabilities, { scope: "the-whole-party" }), /unknown capability scope/);
});
