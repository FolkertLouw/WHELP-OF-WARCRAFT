import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { queryCapabilities } from "../lib/capability-query.mjs";
import { loadSpecCapabilities } from "../lib/load-query-data.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const capabilities = await loadSpecCapabilities(root);

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

test("rejects unknown specialization slugs", () => {
  assert.throws(() => queryCapabilities(capabilities, { specs: ["not-a-real-spec"] }), /unknown spec/);
});

test("rejects unknown actions and scopes instead of returning misleading empty reports", () => {
  assert.throws(() => queryCapabilities(capabilities, { action: "battle-rez" }), /unknown capability action/);
  assert.throws(() => queryCapabilities(capabilities, { scope: "the-whole-party" }), /unknown capability scope/);
});
