local T = WHELP_TEST
local WHELP = WHELP_TEST_NAMESPACE

T.inCombat = false
T:Fire("ADDON_LOADED", "WHELPCollector")
assert(WHELP.db.activeRun == T.savedActiveRun)
T:Fire("PLAYER_ENTERING_WORLD", true, false)

assert(WHELP.db.activeRun == nil)
assert(WHELP.db.activePull == nil)
assert(#WHELP.db.runs == 2)
local abandoned = WHELP.db.runs[2]
assert(abandoned.run.status == "abandoned")
assert(abandoned.run.terminationReason == "recovery-no-matching-challenge")
assert(abandoned.run.telemetryGapCount == 1)
assert(#abandoned.pulls == 1)
