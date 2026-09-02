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

test("rejects unknown specialization slugs", () => {
  assert.throws(() => queryCapabilities(capabilities, { specs: ["not-a-real-spec"] }), /unknown spec/);
});

test("rejects unknown actions and scopes instead of returning misleading empty reports", () => {
  assert.throws(() => queryCapabilities(capabilities, { action: "battle-rez" }), /unknown capability action/);
  assert.throws(() => queryCapabilities(capabilities, { scope: "the-whole-party" }), /unknown capability scope/);
});
