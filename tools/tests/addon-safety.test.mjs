import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..", "..");

test("keeps Patch 12 pull collection away from protected identity APIs", async () => {
  const addonRoot = path.join(root, "addon", "WHELPCollector");
  const files = await Promise.all(["Bootstrap.lua", "Collector.lua", "PullTracker.lua"].map((name) => readFile(path.join(addonRoot, name), "utf8")));
  const source = files.join("\n");
  for (const prohibited of ["COMBAT_LOG_EVENT_UNFILTERED", "CombatLogGetCurrentEventInfo", "UnitGUID", "GetUnitCriteriaProgressValues"]) {
    assert.equal(source.includes(prohibited), false, `${prohibited} must not be used by the collector`);
  }
  for (const required of ["PLAYER_REGEN_DISABLED", "PLAYER_REGEN_ENABLED", "SCENARIO_CRITERIA_UPDATE", "C_ScenarioInfo.GetCriteriaInfo"]) {
    assert.equal(source.includes(required), true, `${required} must support progress-only pull collection`);
  }
});
