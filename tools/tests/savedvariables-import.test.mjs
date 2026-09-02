import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { importWhelpSavedVariables, parseWhelpSavedVariables, sanitizeRun } from "../lib/savedvariables-import.mjs";

const fixturePath = path.join(import.meta.dirname, "fixtures", "savedvariables.synthetic.lua");

test("parses literal WHELP SavedVariables without evaluating code", async () => {
  const database = parseWhelpSavedVariables(await readFile(fixturePath, "utf8"));
  assert.equal(database.schemaVersion, 1);
  assert.equal(database.runs.length, 2);
});

test("allowlists observations, removes secrets, and deduplicates sanitized payloads", async () => {
  const bundle = importWhelpSavedVariables(await readFile(fixturePath, "utf8"));
  assert.deepEqual(bundle.audit, {
    inputRunCount: 2,
    exportedRunCount: 1,
    rejectedRunCount: 0,
    duplicateRunCount: 1,
    strippedFieldCount: 7,
    activeRunExcluded: true,
  });
  assert.equal(bundle.runs[0].sourceIndex, 1);
  assert.match(bundle.runs[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(bundle.runs[0].observation.player.specId, 264);
  assert.equal(bundle.duplicates[0].duplicateOf, 1);
  const publicJson = JSON.stringify(bundle);
  for (const secret of ["Must not survive", "Private Character", "Another Private Character", "secret-one", "secret-two", "secret-three", "different-secret"]) {
    assert.equal(publicJson.includes(secret), false);
  }
});

test("keeps the checked-in sanitized bundle example reproducible", async () => {
  const actual = importWhelpSavedVariables(await readFile(fixturePath, "utf8"));
  actual.$schema = "../schemas/sanitized-observation-bundle.schema.json";
  const example = JSON.parse(await readFile(path.join(import.meta.dirname, "..", "..", "examples", "sanitized-observation-bundle.synthetic.json"), "utf8"));
  assert.deepEqual(actual, example);
});

test("quarantines invalid observations without echoing their values", async () => {
  const source = (await readFile(fixturePath, "utf8")).replace('["keystoneLevel"] = 10', '["keystoneLevel"] = 1');
  const bundle = importWhelpSavedVariables(source);
  assert.equal(bundle.audit.exportedRunCount, 1);
  assert.equal(bundle.audit.rejectedRunCount, 1);
  assert.deepEqual(bundle.rejections, [{ index: 1, code: "invalid-record" }]);
});

test("preserves internally consistent scenario-progress pull evidence", async () => {
  const database = parseWhelpSavedVariables(await readFile(fixturePath, "utf8"));
  const raw = structuredClone(database.runs[0]);
  raw.collector.knowledgeBuild = "12.1.0.69587";
  raw.collector.knowledgeRevision = "a".repeat(64);
  raw.run.pullDataStatus = "progress-only";
  raw.pulls = [{
    order: 1,
    startedAt: 1788300005,
    completedAt: 1788300025,
    durationMs: 20000,
    enemies: [],
    enemyForces: 7,
    enemyForcesSource: "scenario-progress",
    enemyForcesStart: 10,
    enemyForcesEnd: 17,
    enemyIdentityStatus: "unavailable-secret-values",
    deaths: 0,
  }];
  const observation = sanitizeRun(raw);
  assert.equal(observation.pulls[0].enemyForces, 7);
  assert.equal(observation.pulls[0].enemyIdentityStatus, "unavailable-secret-values");
  raw.pulls[0].enemyForces = 8;
  assert.throws(() => sanitizeRun(raw), /Scenario progress/);
  raw.pulls[0].enemyForces = 0;
  raw.pulls[0].enemyForcesSource = "unavailable";
  delete raw.pulls[0].enemyForcesStart;
  delete raw.pulls[0].enemyForcesEnd;
  assert.equal(sanitizeRun(raw).pulls[0].enemyForcesSource, "unavailable");
});

test("rejects executable, sparse, and unexpected SavedVariables programs", () => {
  assert.throws(() => parseWhelpSavedVariables('WHELPCollectorDB = {}; print("oops")'), /exactly one/);
  assert.throws(() => parseWhelpSavedVariables('WHELPCollectorDB = { runs = { [2] = {} } }'), /Sparse Lua arrays/);
  assert.throws(() => parseWhelpSavedVariables('OtherAddonDB = {}'), /WHELPCollectorDB/);
});
