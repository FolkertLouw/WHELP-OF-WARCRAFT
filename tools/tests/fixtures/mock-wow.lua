WHELP_TEST_NAMESPACE = {}
WHELP_TEST = {
    now = 1000,
    version = "12.1.0",
    build = "69587",
    interfaceVersion = 120100,
    mapId = 249,
    keystoneLevel = 10,
    affixIds = { 9 },
    deaths = 0,
    timeLost = 0,
    criteriaQuantity = 0,
    criteriaTotal = 608,
    criteriaAvailable = true,
    messages = {},
}

function WHELP_TEST:Fire(event, ...)
    assert(self.frame and self.frame.events[event], "event not registered: " .. tostring(event))
    self.frame.scripts.OnEvent(self.frame, event, ...)
end

function CreateFrame()
    local frame = { events = {}, scripts = {} }
    function frame:RegisterEvent(event) self.events[event] = true end
    function frame:UnregisterEvent(event) self.events[event] = nil end
    function frame:SetScript(name, callback) self.scripts[name] = callback end
    WHELP_TEST.frame = frame
    return frame
end

function GetBuildInfo()
    return WHELP_TEST.version, WHELP_TEST.build, nil, WHELP_TEST.interfaceVersion
end

function GetServerTime() return WHELP_TEST.now end
function time() return WHELP_TEST.now end
function issecretvalue() return false end
function UnitClass() return "Shaman", "SHAMAN", 7 end
function UnitGroupRolesAssigned(unit) return unit == "player" and "HEALER" or "DAMAGER" end
function UnitIsUnit(left, right) return left == right end
function UnitExists(unit) return unit == "player" end
function GetSpecialization() return 1 end
function GetSpecializationInfo() return 264 end
function GetNumGroupMembers() return 1 end
function IsInRaid() return false end

C_ChallengeMode = {}
function C_ChallengeMode.GetActiveChallengeMapID() return WHELP_TEST.mapId end
function C_ChallengeMode.GetActiveKeystoneInfo() return WHELP_TEST.keystoneLevel, WHELP_TEST.affixIds end
function C_ChallengeMode.GetDeathCount() return WHELP_TEST.deaths, WHELP_TEST.timeLost end

C_ScenarioInfo = {}
function C_ScenarioInfo.GetScenarioStepInfo() return { numCriteria = 4 } end
function C_ScenarioInfo.GetCriteriaInfo(index)
    if not WHELP_TEST.criteriaAvailable or index ~= 4 then
        return { isWeightedProgress = false, quantity = 0, totalQuantity = 1 }
    end
    return {
        isWeightedProgress = true,
        quantity = WHELP_TEST.criteriaQuantity,
        totalQuantity = WHELP_TEST.criteriaTotal,
    }
end

SlashCmdList = {}
function print(message) table.insert(WHELP_TEST.messages, tostring(message)) end
