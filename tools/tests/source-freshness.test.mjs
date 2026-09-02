import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { classifyBuild, classifySource, compileFreshnessReport, loadProvenanceRecords } from "../lib/source-freshness.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const policy = JSON.parse(await readFile(path.join(root, "data", "policies", "source-freshness.json"), "utf8"));
const asOf = new Date("2026-09-02T23:59:59.999Z");

test("classifies current, carried, expired, and future build ranges", () => {
  assert.equal(classifyBuild({ fromBuild: "12.1.0.69587", untilBuild: null }, "12.1.0.69587"), "current");
  assert.equal(classifyBuild({ fromBuild: "12.0.0.1", untilBuild: null }, "12.1.0.69587"), "carried-forward");
  assert.equal(classifyBuild({ fromBuild: "12.0.0.1", untilBuild: "12.0.9.9" }, "12.1.0.69587"), "expired");
  assert.equal(classifyBuild({ fromBuild: "12.2.0.1", untilBuild: null }, "12.1.0.69587"), "future");
});

test("classifies source age and uses declared record timestamp fallbacks", () => {
  const external = classifySource({ kind: "external-reference", retrievedAt: "2026-08-01T00:00:00Z" }, {}, policy, asOf);
  const local = classifySource({ kind: "local-client" }, { observedAt: "2026-09-02T00:00:00Z" }, policy, asOf);
  const missing = classifySource({ kind: "game-data" }, {}, policy, asOf);
  assert.equal(external.status, "stale");
  assert.equal(local.status, "fresh");
  assert.equal(local.timestampOrigin, "observedAt");
  assert.equal(missing.status, "undated");
  assert.equal(classifySource({ kind: "external-reference", retrievedAt: "2026-09-03T00:00:00Z" }, {}, policy, asOf).status, "future-dated");
});

test("uses the freshest source as record evidence while retaining stale source issues", () => {
  const report = compileFreshnessReport({
    records: [{ path: "data/example.json", record: { recordType: "dungeon", id: "example", status: "corroborated", validity: { fromBuild: "12.1.0.69587", untilBuild: null }, provenance: [
      { kind: "external-reference", retrievedAt: "2026-07-01T00:00:00Z" },
      { kind: "external-reference", retrievedAt: "2026-09-02T00:00:00Z" }
    ] } }],
    policy,
    currentBuild: "12.1.0.69587",
    asOf
  });
  assert.equal(report.records[0].evidenceStatus, "fresh");
  assert.equal(report.records[0].needsReview, false);
  assert.deepEqual(report.summary.sourceStatusCounts, { fresh: 1, stale: 1 });
});

test("audits every canonical provenance-bearing record deterministically", async () => {
  const records = await loadProvenanceRecords(root, policy);
  const report = compileFreshnessReport({ records, policy, currentBuild: "12.1.0.69587", asOf });
  assert.ok(report.summary.recordCount >= 170);
  assert.equal(report.summary.recordCount, records.length);
  assert.equal(report.summary.sourceStatusCounts["future-dated"] ?? 0, 0);
  assert.ok(report.records.some((record) => record.recordId === "whelp/source-freshness-policy"));
});
