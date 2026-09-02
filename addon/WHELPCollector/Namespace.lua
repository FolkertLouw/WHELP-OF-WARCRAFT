local addonName, WHELP = ...

WHELP.name = addonName
WHELP.version = "0.5.0"
WHELP.schemaVersion = 1

function WHELP:Now()
    if type(GetServerTime) == "function" then return GetServerTime() end
    return time()
end

function WHELP:Print(message)
    print("|cff66ccffWHELP:|r " .. tostring(message))
end
