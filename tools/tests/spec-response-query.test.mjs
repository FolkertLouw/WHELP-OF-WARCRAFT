import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { querySpecResponses } from "../lib/spec-response-query.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const responseIndexPath = path.join(root, "content", "mythic-plus", "midnight-season-2", "abilities", "response-index.json");
const responseIndex = JSON.parse(await readFile(responseIndexPath, "utf8"));
const responses = await Promise.all(responseIndex.entries.map(async (entry) => JSON.parse(await readFile(path.resolve(path.dirname(responseIndexPath), entry.path), "utf8"))));
const restoration = JSON.parse(await readFile(path.join(root, "data", "specs", "shaman", "restoration.json"), "utf8"));
const enhancement = JSON.parse(await readFile(path.join(root, "data", "specs", "shaman", "enhancement.json"), "utf8"));
const beastMastery = JSON.parse(await readFile(path.join(root, "data", "specs", "hunter", "beast-mastery.json"), "utf8"));
const frostDeathKnight = JSON.parse(await readFile(path.join(root, "data", "specs", "death-knight", "frost.json"), "utf8"));

test("distinguishes Restoration and Enhancement friendly Magic removal", () => {
  const resto = querySpecResponses(responses, restoration, { spellId: 381515 });
  const enhance = querySpecResponses(responses, enhancement, { spellId: 381515 });
  assert.equal(resto.results[0].coverage, "full");
  assert.equal(enhance.results[0].coverage, "partial");
  assert.equal(enhance.results[0].actionCoverage.find((entry) => entry.action === "cleanse-magic").support, "unsupported");
});

test("reports unsupported Enrage removal instead of misusing Purge", () => {
  const result = querySpecResponses(responses, restoration, { dungeonId: "voidscar-arena", action: "soothe" });
  assert.equal(result.resultCount, 1);
  assert.equal(result.results[0].coverage, "none");
  assert.equal(result.results[0].actionCoverage[0].support, "unsupported");
});

test("maps Tranquilizing Shot to Enrage removal for Beast Mastery", () => {
  const result = querySpecResponses(responses, beastMastery, { dungeonId: "voidscar-arena", action: "soothe" });
  assert.equal(result.resultCount, 1);
  assert.equal(result.results[0].coverage, "full");
  assert.equal(result.results[0].actionCoverage[0].tools[0].name, "Tranquilizing Shot");
});

test("preserves universal positional responses", () => {
  const result = querySpecResponses(responses, enhancement, { spellId: 734276 });
  assert.equal(result.results[0].actionCoverage.find((entry) => entry.action === "line-of-sight").support, "universal");
  assert.equal(result.results[0].actionCoverage.find((entry) => entry.action === "defensive").tools[0].name, "Astral Shift");
  assert.equal(result.results[0].actionCoverage.find((entry) => entry.action === "defensive").support, "conditional-self");
});

test("maps Death Knight personal magic defensives without claiming party coverage", () => {
  const result = querySpecResponses(responses, frostDeathKnight, { spellId: 734276 });
  const defensive = result.results[0].actionCoverage.find((entry) => entry.action === "defensive");
  assert.equal(defensive.support, "conditional-self");
  assert.ok(defensive.tools.some((tool) => tool.name === "Anti-Magic Shell"));
  assert.ok(defensive.tools.every((tool) => tool.scope === "self"));
});
