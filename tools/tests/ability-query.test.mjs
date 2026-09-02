import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { queryAbilities } from "../lib/ability-query.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const index = JSON.parse(await readFile(path.join(root, "data", "abilities", "midnight-season-2.json"), "utf8"));

test("queries actionable abilities within one dungeon without leaking other contexts", () => {
  const result = queryAbilities(index, { dungeonId: "altar-of-fangs", tag: "cleanse-poison" });
  assert.ok(result.resultCount > 0);
  assert.equal(result.resultCount, result.results.length);
  for (const ability of result.results) {
    assert.ok(ability.responseTags.includes("cleanse-poison"));
    assert.ok(ability.contexts.every((context) => context.dungeonId === "altar-of-fangs"));
    assert.ok(ability.contexts.some((context) => context.dispelType === "poison"));
  }
});

test("queries exact IDs and case-insensitive name fragments", () => {
  const exact = queryAbilities(index, { spellId: 1217973 });
  assert.equal(exact.resultCount, 1);
  assert.equal(exact.results[0].name, "Curse of Doom");
  assert.ok(exact.results[0].responseTags.includes("cleanse-curse"));
  const byName = queryAbilities(index, { name: "STORMCLOUD" });
  assert.ok(byName.results.some((ability) => ability.name === "Stormcloud Barrier"));
});

test("rejects invalid ability queries", () => {
  assert.throws(() => queryAbilities(index, { tag: "guess" }), /unknown response tag/);
  assert.throws(() => queryAbilities(index, { spellId: 0 }), /positive integer/);
});
