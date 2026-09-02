local _, WHELP = ...

WHELP.Collector = {}

local function gameSnapshot()
    local version, build, _, interfaceVersion = GetBuildInfo()
    return { version = version, build = build, interfaceVersion = interfaceVersion }
end

local function playerSnapshot(unit)
    local _, _, classId = UnitClass(unit)
    local role = UnitGroupRolesAssigned(unit) or "NONE"
    local specId = nil
    if UnitIsUnit(unit, "player") and type(GetSpecialization) == "function" then
        local specialization = GetSpecialization()
        if specialization then specId = GetSpecializationInfo(specialization) end
    end
    return { classId = classId, specId = specId, role = role }
end

local function groupSnapshot()
    local group = {}
    local count = GetNumGroupMembers() or 0
    local prefix = IsInRaid() and "raid" or "party"
    for index = 1, count do
        local unit = prefix .. index
        if UnitExists(unit) and not UnitIsUnit(unit, "player") then
            table.insert(group, playerSnapshot(unit))
        end
    end
    return group
end

local function activeKeystone()
    if not C_ChallengeMode then return nil, nil, {} end
    local mapId = C_ChallengeMode.GetActiveChallengeMapID and C_ChallengeMode.GetActiveChallengeMapID()
    local level, affixIds = nil, {}
    if C_ChallengeMode.GetActiveKeystoneInfo then
        local ok, activeLevel, activeAffixes = pcall(C_ChallengeMode.GetActiveKeystoneInfo)
        if ok then
            level = activeLevel
            affixIds = type(activeAffixes) == "table" and activeAffixes or {}
        end
    end
    return mapId, level, affixIds
end

function WHELP.Collector:UpdateDeathCount()
    local observation = WHELP.db.activeRun
    if not observation or not C_ChallengeMode or not C_ChallengeMode.GetDeathCount then return end
    local ok, deaths, timeLost = pcall(C_ChallengeMode.GetDeathCount)
    if not ok then return end
    observation.run.deathCount = tonumber(deaths) or observation.run.deathCount or 0
    observation.run.deathTimeLostMs = math.floor((tonumber(timeLost) or 0) * 1000)
end

function WHELP.Collector:StartEncounter(encounterId)
    if not WHELP.db.activeRun or not tonumber(encounterId) then return end
    WHELP.db.activeEncounter = { encounterId = tonumber(encounterId), startedAt = WHELP:Now() }
end

function WHELP.Collector:EndEncounter(encounterId, success)
    local observation = WHELP.db.activeRun
    local active = WHELP.db.activeEncounter
    if not observation or not active or active.encounterId ~= tonumber(encounterId) then return end
    local completedAt = WHELP:Now()
    table.insert(observation.encounters, {
        encounterId = active.encounterId,
        startedAt = active.startedAt,
        completedAt = completedAt,
        durationMs = math.max(0, completedAt - active.startedAt) * 1000,
        success = tonumber(success) == 1,
    })
    WHELP.db.activeEncounter = nil
end

function WHELP.Collector:StartRun()
    if not WHELP.db.settings.collectionEnabled then return end
    local mapId, level, affixIds = activeKeystone()
    if not mapId or not level then
        WHELP:Print("Could not identify the active keystone; no run was recorded.")
        return
    end
    WHELP.db.activeRun = {
        schemaVersion = WHELP.schemaVersion,
        recordType = "run-observation",
        collector = { name = "WHELP Collector", version = WHELP.version },
        game = gameSnapshot(),
        run = {
            challengeMapId = mapId,
            keystoneLevel = level,
            affixIds = affixIds,
            startedAt = WHELP:Now(),
            deathCount = 0,
            deathTimeLostMs = 0,
            status = "started",
        },
        encounters = {},
        player = playerSnapshot("player"),
        group = groupSnapshot(),
        privacy = { containsNames = false, containsChat = false },
    }
    WHELP.PullTracker:Configure()
    WHELP:Print("Started privacy-safe run observation.")
end

local function finishRun(status)
    local observation = WHELP.db.activeRun
    if not observation then return end
    WHELP.Collector:UpdateDeathCount()
    WHELP.PullTracker:EndPull()
    observation.run.completedAt = WHELP:Now()
    observation.run.durationMs = math.max(0, observation.run.completedAt - observation.run.startedAt) * 1000
    observation.run.status = status
    WHELP.Database:AddRun(observation)
    WHELP.db.activeRun = nil
    WHELP.db.activeEncounter = nil
    WHELP.PullTracker:Reset()
end

function WHELP.Collector:CompleteRun()
    finishRun("completed")
    WHELP:Print("Stored run observation locally. Nothing was uploaded.")
end

function WHELP.Collector:AbandonRun()
    finishRun("abandoned")
end
