import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { queryAbilityResponses } from "../lib/ability-response-query.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const load = async (dungeon) => JSON.parse(await readFile(
  path.join(root, "content", "mythic-plus", "midnight-season-2", dungeon, "strategy", "ability-priorities.json"),
  "utf8",
));
const records = await Promise.all([load("murder-row"), load("the-blinding-vale")]);

test("queries explicit response actions without confusing purge and cleanse", () => {
  const cleanses = queryAbilityResponses(records, { dungeonId: "murder-row", action: "cleanse-magic" });
  assert.ok(cleanses.results.some((entry) => entry.name === "Seduction"));
  assert.ok(cleanses.results.every((entry) => entry.targetDisposition !== "enemy-buff"));
  const soothes = queryAbilityResponses(records, { dungeonId: "murder-row", action: "soothe" });
  assert.ok(soothes.results.some((entry) => entry.name === "Back to Work!"));
  assert.ok(soothes.results.every((entry) => entry.targetDisposition !== "player-debuff"));
});

test("curated positional response overrides a misleading low-level flag", () => {
  const result = queryAbilityResponses(records, { spellId: 734276 });
  assert.equal(result.resultCount, 1);
  assert.deepEqual(result.results[0].actions, ["line-of-sight", "defensive"]);
  assert.equal(result.results[0].targetDisposition, "positional");
});

test("filters priorities and rejects invalid response queries", () => {
  const critical = queryAbilityResponses(records, { dungeonId: "the-blinding-vale", priority: "critical" });
  assert.ok(critical.resultCount > 0);
  assert.ok(critical.results.every((entry) => entry.priority === "critical"));
  assert.throws(() => queryAbilityResponses(records, { action: "guess" }), /unknown response action/);
  assert.throws(() => queryAbilityResponses(records, { spellId: 0 }), /positive integer/);
});
