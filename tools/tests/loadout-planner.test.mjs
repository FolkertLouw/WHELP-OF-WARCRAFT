import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { buildPartyGapReport, buildSpecLoadout } from "../lib/loadout-planner.mjs";
import { loadResponseRecords, loadSpecCapabilities } from "../lib/load-query-data.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const responses = await loadResponseRecords(root);
const capabilities = await loadSpecCapabilities(root);
const restoration = capabilities.find((record) => record.spec.slug === "restoration-shaman");
const enhancement = capabilities.find((record) => record.spec.slug === "enhancement-shaman");

test("builds a deduplicated spec loadout with mechanic references", () => {
  const loadout = buildSpecLoadout(responses, restoration, "ruby-life-pools");
  assert.ok(loadout.recommendedTools.some((tool) => tool.name === "Purge" && tool.mechanicReferences.length === 2));
  assert.ok(loadout.recommendedTools.some((tool) => tool.name === "Purify Spirit"));
  assert.ok(loadout.selfOnlyResponses.some((entry) => entry.action === "defensive"));
});

test("keeps unsupported spec actions visible", () => {
  const loadout = buildSpecLoadout(responses, enhancement, "ruby-life-pools");
  assert.ok(loadout.unsupportedActions.some((entry) => entry.name === "Stormslam" && entry.action === "cleanse-magic"));
});

test("reports party utility gaps without claiming personal responses as coverage", () => {
  const report = buildPartyGapReport(responses, [restoration, enhancement], "murder-row");
  assert.ok(report.uncoveredUtility.some((entry) => entry.name === "Back to Work!" && entry.action === "soothe"));
  assert.ok(report.coveredUtility.some((entry) => entry.name === "Curse of Doom" && entry.action === "cleanse-curse"));
  assert.ok(report.individualResponses.some((entry) => entry.name === "Murder in a Row" && entry.action === "line-of-sight"));
});
