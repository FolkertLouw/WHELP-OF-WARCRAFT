local T = WHELP_TEST
local WHELP = WHELP_TEST_NAMESPACE

T:Fire("ADDON_LOADED", "AnotherAddon")
assert(WHELP.db == nil)
T:Fire("ADDON_LOADED", "WHELPCollector")
assert(WHELP.db ~= nil)
assert(WHELP.db.settings.collectionEnabled == true)

T:Fire("CHALLENGE_MODE_START")
local active = WHELP.db.activeRun
assert(active.recordType == "run-observation")
assert(active.collector.version == "0.4.6")
assert(active.collector.knowledgeBuild == "12.1.0.69587")
assert(type(active.collector.knowledgeRevision) == "string" and #active.collector.knowledgeRevision == 64)
assert(active.run.pullDataStatus == "progress-only")
assert(active.privacy.containsNames == false and active.privacy.containsChat == false)

T.now = 1005
T:Fire("PLAYER_REGEN_DISABLED")
T.now = 1020
T.criteriaQuantity = 44
T.deaths = 1
T.timeLost = 5
T:Fire("SCENARIO_CRITERIA_UPDATE", 0)
T:Fire("PLAYER_REGEN_ENABLED")
local first = active.pulls[1]
assert(first.order == 1)
assert(first.durationMs == 15000)
assert(first.enemyForces == 44)
assert(first.enemyForcesSource == "scenario-progress")
assert(first.enemyForcesStart == 0 and first.enemyForcesEnd == 44)
assert(first.enemyIdentityStatus == "unavailable-secret-values")
assert(#first.enemies == 0)
assert(first.deaths == 1)
assert(first.endReason == "combat-ended")

T.now = 1030
T:Fire("PLAYER_REGEN_DISABLED")
T.now = 1031
T:Fire("ENCOUNTER_START", 2139)
T.now = 1039
T:Fire("ENCOUNTER_END", 2139, "The Golden Serpent", 8, 5, 1)
T.now = 1040
T:Fire("PLAYER_REGEN_ENABLED")
local boss = active.pulls[2]
assert(boss.order == 2 and boss.enemyForces == 0 and boss.durationMs == 10000)
assert(active.encounters[1].encounterId == 2139)
assert(active.encounters[1].success == true)

T.now = 1050
T:Fire("CHALLENGE_MODE_COMPLETED")
assert(WHELP.db.activeRun == nil)
assert(#WHELP.db.runs == 1)
local completed = WHELP.db.runs[1]
assert(completed.run.status == "completed")
assert(completed.run.durationMs == 50000)
assert(completed.run.deathCount == 1 and completed.run.deathTimeLostMs == 5000)
assert(completed.run.recoveryCount == 0 and completed.run.telemetryGapCount == 0)
assert(completed.run.terminationReason == "challenge-completed")
assert(#completed.pulls == 2)
assert(completed.pulls[2].completedAt <= completed.run.completedAt)
for _, prohibited in ipairs({ "playerName", "characterName", "battleTag", "guild", "guid", "chat" }) do
    assert(completed[prohibited] == nil and completed.player[prohibited] == nil)
end

T.version = "12.1.1"
T.build = "70000"
T.now = 2000
T.criteriaQuantity = 0
T.deaths = 0
T.timeLost = 0
T:Fire("CHALLENGE_MODE_START")
active = WHELP.db.activeRun
assert(active.run.pullDataStatus == "build-mismatch")
T.now = 2005
T:Fire("PLAYER_REGEN_DISABLED")
T.now = 2010
T.criteriaQuantity = 22
T:Fire("PLAYER_REGEN_ENABLED")
assert(active.pulls[1].enemyForces == 0)
assert(active.pulls[1].enemyForcesSource == "unavailable")
assert(active.pulls[1].enemyForcesStart == nil and active.pulls[1].enemyForcesEnd == nil)
T.now = 2020
T:Fire("CHALLENGE_MODE_RESET")
assert(WHELP.db.runs[2].run.status == "abandoned")
assert(WHELP.db.runs[2].run.terminationReason == "challenge-reset")

T.version = "12.1.0"
T.build = "69587"
T.criteriaAvailable = false
T.now = 3000
T:Fire("CHALLENGE_MODE_START")
active = WHELP.db.activeRun
assert(active.run.pullDataStatus == "progress-only")
T.now = 3005
T:Fire("PLAYER_REGEN_DISABLED")
T.now = 3010
T:Fire("PLAYER_REGEN_ENABLED")
assert(active.pulls[1].enemyForcesSource == "unavailable")
T.now = 3020
T:Fire("CHALLENGE_MODE_RESET")

WHELP.db.settings.collectionEnabled = false
T.now = 4000
T:Fire("CHALLENGE_MODE_START")
assert(WHELP.db.activeRun == nil)
assert(#WHELP.db.runs == 3)
