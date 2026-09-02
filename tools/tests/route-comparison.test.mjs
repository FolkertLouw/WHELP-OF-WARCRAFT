import assert from "node:assert/strict";
import test from "node:test";
import { compareRunToRoute } from "../lib/route-comparison.mjs";

const route = {
  recordType: "route",
  id: "synthetic/baseline",
  challengeMapId: 100,
  targetEnemyForces: 12,
  pulls: [
    { id: "pull-a", order: 1, enemyForces: 5, enemies: [{ npcId: 1, count: 1 }] },
    { id: "pull-b", order: 2, enemyForces: 7, enemies: [{ npcId: 2, count: 2 }], afterEncounterId: 90 },
  ],
};

function observation(pulls) {
  return {
    recordType: "run-observation",
    collector: { version: "0.2.0" },
    game: { version: "12.1.0", build: "69587" },
    run: { challengeMapId: 100, routePlanId: "synthetic/baseline", keystoneLevel: 10, affixIds: [9], startedAt: 1000, durationMs: 90000, deathCount: 2, status: "completed" },
    pulls,
    encounters: [{ encounterId: 90, startedAt: 1050, completedAt: 1060, durationMs: 10000, success: true }],
  };
}

test("compares explicit pull links, count drift, deaths, and checkpoints", () => {
  const report = compareRunToRoute(route, observation([
    { order: 1, plannedPullId: "pull-a", enemyForces: 5, durationMs: 20000, deaths: 0, enemies: [{ npcId: 1, count: 1 }] },
    { order: 3, plannedPullId: "pull-b", enemyForces: 10, durationMs: 30000, deaths: 1, enemies: [{ npcId: 2, count: 3 }, { npcId: 3, count: 1 }] },
  ]));

  assert.equal(report.matchQuality.explicitPullIdMatches, 2);
  assert.deepEqual(report.observation, {
    gameVersion: "12.1.0",
    gameBuild: "69587",
    collectorVersion: "0.2.0",
    knowledgeBuild: null,
    knowledgeRevision: null,
    pullDataStatus: null,
    keystoneLevel: 10,
    affixIds: [9],
    startedAt: 1000,
    status: "completed",
  });
  assert.equal(report.matchQuality.orderInferredMatches, 0);
  assert.equal(report.summary.enemyForcesDelta, 3);
  assert.equal(report.summary.unattributedDeaths, 1);
  assert.deepEqual(report.pulls[1].enemyCountDrift, [
    { npcId: 2, plannedCount: 2, observedCount: 3, delta: 1 },
    { npcId: 3, plannedCount: 0, observedCount: 1, delta: 1 },
  ]);
  assert.equal(report.checkpoints[0].completedElapsedMs, 60000);
});

test("labels order-only matches as inferred", () => {
  const report = compareRunToRoute(route, observation([
    { order: 1, enemyForces: 5, durationMs: 20, deaths: 0, enemies: [{ npcId: 1, count: 1 }] },
  ]));
  assert.equal(report.matchQuality.orderInferredMatches, 1);
  assert.equal(report.matchQuality.missingPlannedPulls, 1);
  assert.match(report.warnings[0], /inferred by order/);
});

test("does not invent enemy identity drift for Patch 12 scenario-only pulls", () => {
  const report = compareRunToRoute(route, observation([
    {
      order: 1,
      enemyForces: 5,
      enemyForcesSource: "scenario-progress",
      enemyForcesStart: 0,
      enemyForcesEnd: 5,
      enemyIdentityStatus: "unavailable-secret-values",
      durationMs: 20,
      deaths: 0,
      enemies: [],
    },
  ]));
  assert.equal(report.pulls[0].enemyCountDrift, null);
  assert.match(report.warnings.join(" "), /secret-value restrictions/);
});

test("keeps unknown planned IDs visible as extra pulls", () => {
  const report = compareRunToRoute(route, observation([
    { order: 1, plannedPullId: "different-pull", enemyForces: 4, durationMs: 20, deaths: 0, enemies: [] },
  ]));
  assert.equal(report.matchQuality.extraObservedPulls, 1);
  assert.equal(report.extraPulls[0].reason, "unknown-planned-pull-id");
});

test("rejects incompatible routes and duplicate explicit links", () => {
  assert.throws(() => compareRunToRoute(route, { ...observation([]), run: { challengeMapId: 200 } }), /challengeMapId mismatch/);
  assert.throws(() => compareRunToRoute(route, observation([
    { order: 1, plannedPullId: "pull-a", enemyForces: 5, deaths: 0, enemies: [] },
    { order: 2, plannedPullId: "pull-a", enemyForces: 5, deaths: 0, enemies: [] },
  ])), /multiple observed pulls/);
});
