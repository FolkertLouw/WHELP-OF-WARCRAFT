import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { loadSpecCapabilities, loadSpecDungeonMatrices } from "../lib/load-query-data.mjs";
import { queryMatrixCoverage } from "../lib/matrix-coverage-query.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const capabilities = await loadSpecCapabilities(root);
const matrices = await loadSpecDungeonMatrices(root);
const season = JSON.parse(await readFile(path.join(root, "data", "seasons", "midnight-season-2.json"), "utf8"));

test("reports explicit full-matrix and capability-only coverage", () => {
  const report = queryMatrixCoverage(capabilities, matrices, season);
  assert.equal(report.summary.modeledSpecCount, 21);
  assert.equal(report.summary.matrixSpecCount, 10);
  assert.equal(report.summary.fullMatrixSpecCount, 10);
  assert.equal(report.summary.capabilityOnlySpecCount, 11);
  const beastMastery = report.entries.find((entry) => entry.spec.slug === "beast-mastery-hunter");
  assert.equal(beastMastery.completeSeasonCoverage, true);
  assert.deepEqual(beastMastery.missingDungeonIds, []);
  const marksmanship = report.entries.find((entry) => entry.spec.slug === "marksmanship-hunter");
  assert.equal(marksmanship.completeSeasonCoverage, true);
  const survival = report.entries.find((entry) => entry.spec.slug === "survival-hunter");
  assert.equal(survival.completeSeasonCoverage, true);
  const arcane = report.entries.find((entry) => entry.spec.slug === "arcane-mage");
  assert.equal(arcane.completeSeasonCoverage, true);
  assert.deepEqual(arcane.missingDungeonIds, []);
  const fire = report.entries.find((entry) => entry.spec.slug === "fire-mage");
  assert.equal(fire.completeSeasonCoverage, true);
});

test("rejects malformed coverage inputs", () => {
  assert.throws(() => queryMatrixCoverage([{}], matrices, season), /spec-capabilities/);
  assert.throws(() => queryMatrixCoverage(capabilities, [{}], season), /spec-dungeon-matrix/);
  assert.throws(() => queryMatrixCoverage(capabilities, matrices, {}), /season record/);
});
