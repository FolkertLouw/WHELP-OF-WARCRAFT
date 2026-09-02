local T = WHELP_TEST
local WHELP = WHELP_TEST_NAMESPACE

T:Fire("ADDON_LOADED", "WHELPCollector")
assert(WHELP.db.activeRun == T.savedActiveRun)
T:Fire("PLAYER_ENTERING_WORLD", true, false)

local active = WHELP.db.activeRun
assert(active.run.recoveryCount == 1)
assert(active.run.lastRecoveredAt == 1030)
assert(active.run.telemetryGapCount == 0)
assert(#active.pulls == 1)
assert(WHELP.db.activePull.startedAt == 1025)
T:Fire("PLAYER_ENTERING_WORLD", false, false)
assert(active.run.recoveryCount == 1)

T.now = 1040
T.criteriaQuantity = 50
T.deaths = 1
T.timeLost = 5
T:Fire("ENCOUNTER_END", 2139, "The Golden Serpent", 8, 5, 1)
T.inCombat = false
T:Fire("PLAYER_REGEN_ENABLED")
assert(#active.pulls == 2)
assert(active.pulls[2].startedAt == 1025 and active.pulls[2].completedAt == 1040)
assert(active.pulls[2].enemyForces == 30)
assert(active.pulls[2].endReason == "combat-ended")
assert(active.encounters[1].durationMs == 14000)

T.now = 1050
T:Fire("CHALLENGE_MODE_COMPLETED")
assert(#WHELP.db.runs == 1)
assert(WHELP.db.runs[1].run.terminationReason == "challenge-completed")

T.now = 2000
T.criteriaQuantity = 0
T.deaths = 0
T.timeLost = 0
T:Fire("CHALLENGE_MODE_START")
active = WHELP.db.activeRun
T.now = 2005
T.inCombat = true
T:Fire("PLAYER_REGEN_DISABLED")
T.now = 2010
T.criteriaQuantity = 10
T.inCombat = false
T:Fire("PLAYER_REGEN_ENABLED")
assert(#active.pulls == 1)
T.now = 2015
T.inCombat = true
T:Fire("PLAYER_REGEN_DISABLED")
assert(WHELP.db.activePull ~= nil)
T.mapId = nil
T.now = 2030
T.savedActiveRun = active
