local _, WHELP = ...

WHELP.Database = {}
local MAX_RUNS = 250

function WHELP.Database:Initialize()
    WHELPCollectorDB = WHELPCollectorDB or {}
    WHELPCollectorDB.schemaVersion = WHELP.schemaVersion
    WHELPCollectorDB.collectorVersion = WHELP.version
    WHELPCollectorDB.runs = WHELPCollectorDB.runs or {}
    WHELPCollectorDB.settings = WHELPCollectorDB.settings or {}
    if WHELPCollectorDB.settings.collectionEnabled == nil then
        WHELPCollectorDB.settings.collectionEnabled = true
    end
    WHELP.db = WHELPCollectorDB
end

function WHELP.Database:AddRun(run)
    table.insert(WHELP.db.runs, run)
    while #WHELP.db.runs > MAX_RUNS do table.remove(WHELP.db.runs, 1) end
end
