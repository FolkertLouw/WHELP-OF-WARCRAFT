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
const beastMastery = capabilities.find((record) => record.spec.slug === "beast-mastery-hunter");
const marksmanship = capabilities.find((record) => record.spec.slug === "marksmanship-hunter");
const survival = capabilities.find((record) => record.spec.slug === "survival-hunter");
const holyPaladin = capabilities.find((record) => record.spec.slug === "holy-paladin");
const protectionPaladin = capabilities.find((record) => record.spec.slug === "protection-paladin");
const retributionPaladin = capabilities.find((record) => record.spec.slug === "retribution-paladin");

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

test("uses Beast Mastery enemy dispels to close party purge and soothe gaps", () => {
  const report = buildPartyGapReport(responses, [restoration, enhancement, beastMastery], "murder-row");
  const soothe = report.coveredUtility.find((entry) => entry.name === "Back to Work!" && entry.action === "soothe");
  assert.ok(soothe);
  assert.ok(soothe.handlers.some((handler) => handler.toolName === "Tranquilizing Shot"));
  assert.ok(!report.uncoveredUtility.some((entry) => entry.name === "Back to Work!" && entry.action === "soothe"));
});

test("builds a Beast Mastery loadout without inventing a friendly Magic cleanse", () => {
  const loadout = buildSpecLoadout(responses, beastMastery, "ruby-life-pools");
  assert.ok(loadout.recommendedTools.some((tool) => tool.name === "Tranquilizing Shot"));
  assert.ok(loadout.unsupportedActions.some((entry) => entry.name === "Stormslam" && entry.action === "cleanse-magic"));
  assert.ok(loadout.selfOnlyResponses.some((entry) => entry.name === "Stormslam" && entry.action === "defensive"));
});

test("preserves ranged and melee Hunter interrupt identities", () => {
  const marksmanLoadout = buildSpecLoadout(responses, marksmanship, "murder-row");
  const survivalLoadout = buildSpecLoadout(responses, survival, "murder-row");
  assert.ok(marksmanLoadout.recommendedTools.some((tool) => tool.name === "Counter Shot"));
  assert.ok(!marksmanLoadout.recommendedTools.some((tool) => tool.name === "Muzzle"));
  assert.ok(survivalLoadout.recommendedTools.some((tool) => tool.name === "Muzzle"));
  assert.ok(!survivalLoadout.recommendedTools.some((tool) => tool.name === "Counter Shot"));
});

test("distinguishes Holy and non-healer Paladin Magic cleansing", () => {
  const holy = buildSpecLoadout(responses, holyPaladin, "ruby-life-pools");
  const retribution = buildSpecLoadout(responses, retributionPaladin, "ruby-life-pools");
  assert.ok(holy.recommendedTools.some((tool) => tool.name === "Cleanse"));
  assert.ok(!holy.unsupportedActions.some((entry) => entry.name === "Stormslam" && entry.action === "cleanse-magic"));
  assert.ok(retribution.unsupportedActions.some((entry) => entry.name === "Stormslam" && entry.action === "cleanse-magic"));
});

test("uses Cleanse Toxins for disease recovery without claiming Magic removal", () => {
  const loadout = buildSpecLoadout(responses, protectionPaladin, "kings-rest");
  const cleanse = loadout.recommendedTools.find((tool) => tool.name === "Cleanse Toxins");
  assert.ok(cleanse.mechanicReferences.some((entry) => entry.name === "Wretched Discharge" && entry.action === "cleanse-disease"));
  assert.equal(cleanse.availability, "talent");
});
