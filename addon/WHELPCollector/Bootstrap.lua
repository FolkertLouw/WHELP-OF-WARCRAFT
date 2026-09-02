local addonName, WHELP = ...

local frame = CreateFrame("Frame")
frame:RegisterEvent("ADDON_LOADED")
for _, eventName in ipairs({
    "CHALLENGE_MODE_START",
    "CHALLENGE_MODE_COMPLETED",
    "CHALLENGE_MODE_RESET",
}) do
    pcall(frame.RegisterEvent, frame, eventName)
end

frame:SetScript("OnEvent", function(_, event, ...)
    if event == "ADDON_LOADED" then
        if ... ~= addonName then return end
        WHELP.Database:Initialize()
        SLASH_WHELPCOLLECTOR1 = "/whelp"
        SlashCmdList.WHELPCOLLECTOR = function(message)
            local command = tostring(message or ""):lower():match("^%s*(.-)%s*$")
            if command == "status" or command == "" then
                WHELP:Print(string.format(
                    "collection %s; %d completed observations stored locally.",
                    WHELP.db.settings.collectionEnabled and "enabled" or "disabled",
                    #WHELP.db.runs
                ))
            elseif command == "on" then
                WHELP.db.settings.collectionEnabled = true
                WHELP:Print("collection enabled.")
            elseif command == "off" then
                WHELP.db.settings.collectionEnabled = false
                WHELP:Print("collection disabled.")
            else
                WHELP:Print("commands: /whelp status, /whelp on, /whelp off")
            end
        end
        WHELP:Print("Collector ready. Data remains local unless explicitly exported.")
    elseif event == "CHALLENGE_MODE_START" then
        WHELP.Collector:StartRun()
    elseif event == "CHALLENGE_MODE_COMPLETED" then
        WHELP.Collector:CompleteRun()
    elseif event == "CHALLENGE_MODE_RESET" then
        WHELP.Collector:AbandonRun()
    end
end)
