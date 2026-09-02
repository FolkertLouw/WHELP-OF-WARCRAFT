import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { loadSpecDungeonMatrices } from "../lib/load-query-data.mjs";
import { buildSourceAuditCoverage, querySourceAuditCoverage } from "../lib/source-audit-coverage.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const manifest = JSON.parse(await readFile(path.join(root, "whelp.json"), "utf8"));
const index = JSON.parse(await readFile(path.join(root, "data", "index.json"), "utf8"));
const audits = await Promise.all(index.sourceClaimAudits.map(async ({ record }) => JSON.parse(await readFile(path.join(root, "data", record), "utf8"))));
const coverage = JSON.parse(await readFile(path.join(root, "data", index.sourceAuditCoverage.record), "utf8"));

test("keeps source-audit coverage reproducible across all specialization matrices", async () => {
  const generated = buildSourceAuditCoverage(await loadSpecDungeonMatrices(root), audits, {
    seasonSlug: manifest.currentSeason,
    currentBuild: manifest.currentBuild,
  });
  assert.deepEqual(coverage, generated);
  assert.equal(coverage.isCatalogComplete, true);
  assert.deepEqual(coverage.summary, {
    specializationCount: 40,
    fullyAudited: 0,
    partiallyAudited: 6,
    provenanceOnly: 34,
    noSource: 0,
  });
});

test("reports exact audited scopes without treating provenance as claim review", () => {
  const partial = querySourceAuditCoverage(coverage, { level: "partially-audited" });
  assert.deepEqual(partial.map((entry) => entry.specSlug), [
    "augmentation-evoker", "devastation-evoker", "elemental-shaman", "enhancement-shaman", "preservation-evoker", "restoration-shaman",
  ]);
  assert.equal(querySourceAuditCoverage(coverage, { specSlug: "augmentation-evoker" })[0].claimCount, 32);
  assert.equal(querySourceAuditCoverage(coverage, { specSlug: "devastation-evoker" })[0].claimCount, 32);
  assert.equal(querySourceAuditCoverage(coverage, { specSlug: "elemental-shaman" })[0].claimCount, 46);
  assert.equal(querySourceAuditCoverage(coverage, { specSlug: "preservation-evoker" })[0].claimCount, 29);
  assert.equal(querySourceAuditCoverage(coverage, { specSlug: "augmentation-evoker" })[0].coverageLevel, "partially-audited");
});

test("rejects invalid coverage filters", () => {
  assert.throws(() => querySourceAuditCoverage(coverage, { level: "looks-good" }), /level/);
  assert.throws(() => querySourceAuditCoverage({ recordType: "source-claim-audit" }), /source-audit-coverage/);
});
