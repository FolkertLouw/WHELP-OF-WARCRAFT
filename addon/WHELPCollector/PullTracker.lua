local _, WHELP = ...

WHELP.PullTracker = {}

local runtime = {
    activePull = nil,
    latestEnemyForces = nil,
    dungeon = nil,
}

local function isSecret(value)
    return type(issecretvalue) == "function" and issecretvalue(value)
end

local function currentDungeon()
    local run = WHELP.db and WHELP.db.activeRun
    local knowledge = WHELP.GeneratedKnowledge
    if not run or not knowledge or not knowledge.dungeons then return nil end
    return knowledge.dungeons[run.run.challengeMapId]
end

local function currentBuild()
    local run = WHELP.db and WHELP.db.activeRun
    if not run then return nil end
    return tostring(run.game.version) .. "." .. tostring(run.game.build)
end

local function scenarioEnemyForces()
    if not runtime.dungeon or not C_ScenarioInfo or not C_ScenarioInfo.GetCriteriaInfo then return nil end
    if not C_ScenarioInfo.GetScenarioStepInfo then return nil end
    local ok, step = pcall(C_ScenarioInfo.GetScenarioStepInfo)
    if not ok or type(step) ~= "table" or isSecret(step.numCriteria) then return nil end
    local criteriaCount = tonumber(step.numCriteria)
    if not criteriaCount or criteriaCount < 1 or criteriaCount > 100 then return nil end
    for index = 1, criteriaCount do
        local criteriaOk, info = pcall(C_ScenarioInfo.GetCriteriaInfo, index)
        if criteriaOk and type(info) == "table"
            and not isSecret(info.isWeightedProgress)
            and info.isWeightedProgress == true
            and not isSecret(info.totalQuantity)
            and not isSecret(info.quantity)
            and tonumber(info.totalQuantity) == runtime.dungeon.enemyForcesTotal then
            local quantity = tonumber(info.quantity)
            if quantity and quantity >= 0 and quantity <= runtime.dungeon.enemyForcesTotal and quantity == math.floor(quantity) then
                return quantity
            end
        end
    end
    return nil
end

local function isInteger(value)
    return type(value) == "number" and value == math.floor(value)
end

local function validCheckpoint(checkpoint, observation)
    if type(checkpoint) ~= "table" then return false end
    if not isInteger(checkpoint.startedAt)
        or checkpoint.startedAt < observation.run.startedAt
        or checkpoint.startedAt > WHELP:Now() then return false end
    if not isInteger(checkpoint.deathsAtStart) or checkpoint.deathsAtStart < 0 then return false end
    return checkpoint.enemyForcesAtStart == nil
        or (isInteger(checkpoint.enemyForcesAtStart) and checkpoint.enemyForcesAtStart >= 0)
end

function WHELP.PullTracker:Configure(resume)
    runtime.activePull = nil
    runtime.latestEnemyForces = nil
    runtime.dungeon = nil
    local observation = WHELP.db and WHELP.db.activeRun
    if not observation then return end
    if resume and type(observation.pulls) == "table" then
        if validCheckpoint(WHELP.db.activePull, observation) then
            runtime.activePull = WHELP.db.activePull
        else
            WHELP.db.activePull = nil
        end
    else
        observation.pulls = {}
        WHELP.db.activePull = nil
    end
    local knowledge = WHELP.GeneratedKnowledge
    if not knowledge then
        observation.run.pullDataStatus = "knowledge-unavailable"
        return
    end
    observation.collector.knowledgeBuild = knowledge.dataBuild
    observation.collector.knowledgeRevision = knowledge.datasetHash
    if knowledge.dataBuild ~= currentBuild() then
        observation.run.pullDataStatus = "build-mismatch"
        return
    end
    runtime.dungeon = currentDungeon()
    if not runtime.dungeon then
        observation.run.pullDataStatus = "dungeon-unknown"
        return
    end
    observation.run.pullDataStatus = "progress-only"
    runtime.latestEnemyForces = scenarioEnemyForces()
end

function WHELP.PullTracker:RefreshProgress()
    if not WHELP.db or not WHELP.db.activeRun or not runtime.dungeon then return end
    local forces = scenarioEnemyForces()
    if forces ~= nil then runtime.latestEnemyForces = forces end
end

function WHELP.PullTracker:StartPull()
    local observation = WHELP.db and WHELP.db.activeRun
    if not observation or runtime.activePull then return end
    self:RefreshProgress()
    runtime.activePull = {
        startedAt = WHELP:Now(),
        deathsAtStart = tonumber(observation.run.deathCount) or 0,
        enemyForcesAtStart = runtime.latestEnemyForces,
    }
    WHELP.db.activePull = runtime.activePull
end

function WHELP.PullTracker:EndPull(reason)
    local observation = WHELP.db and WHELP.db.activeRun
    local active = runtime.activePull
    if not observation or not active then return end
    self:RefreshProgress()
    local completedAt = WHELP:Now()
    local forcesAtEnd = runtime.latestEnemyForces
    local enemyForces = 0
    local source = "unavailable"
    if active.enemyForcesAtStart ~= nil and forcesAtEnd ~= nil and forcesAtEnd >= active.enemyForcesAtStart then
        enemyForces = forcesAtEnd - active.enemyForcesAtStart
        source = "scenario-progress"
    end
    table.insert(observation.pulls, {
        order = #observation.pulls + 1,
        startedAt = active.startedAt,
        completedAt = completedAt,
        durationMs = math.max(0, completedAt - active.startedAt) * 1000,
        enemies = {},
        enemyForces = enemyForces,
        enemyForcesSource = source,
        enemyForcesStart = active.enemyForcesAtStart,
        enemyForcesEnd = forcesAtEnd,
        enemyIdentityStatus = "unavailable-secret-values",
        deaths = math.max(0, (tonumber(observation.run.deathCount) or 0) - active.deathsAtStart),
        endReason = reason or "combat-ended",
    })
    runtime.activePull = nil
    WHELP.db.activePull = nil
end

function WHELP.PullTracker:Reset()
    runtime.activePull = nil
    runtime.latestEnemyForces = nil
    runtime.dungeon = nil
    if WHELP.db then WHELP.db.activePull = nil end
end
