local T = WHELP_TEST
local WHELP = WHELP_TEST_NAMESPACE

T:Fire("ADDON_LOADED", "WHELPCollector")
T:Fire("CHALLENGE_MODE_START")
local active = WHELP.db.activeRun

T.now = 1005
T.inCombat = true
T:Fire("PLAYER_REGEN_DISABLED")
T.now = 1020
T.criteriaQuantity = 20
T.inCombat = false
T:Fire("PLAYER_REGEN_ENABLED")
assert(#active.pulls == 1)

T.now = 1025
T.inCombat = true
T:Fire("PLAYER_REGEN_DISABLED")
T.now = 1026
T:Fire("ENCOUNTER_START", 2139)
assert(WHELP.db.activePull.startedAt == 1025)
T.savedActiveRun = active
T.now = 1030
