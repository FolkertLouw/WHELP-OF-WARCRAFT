WHELPCollectorDB = {
    ["schemaVersion"] = 1,
    ["collectorVersion"] = "0.2.0",
    ["accountName"] = "Must not survive",
    ["activeRun"] = {},
    ["settings"] = { ["collectionEnabled"] = true },
    ["runs"] = {
        [1] = {
            ["schemaVersion"] = 1,
            ["recordType"] = "run-observation",
            ["collector"] = { ["name"] = "WHELP Collector", ["version"] = "0.2.0", ["token"] = "secret-one" },
            ["game"] = { ["version"] = "12.1.0", ["build"] = "69587", ["interfaceVersion"] = 120100 },
            ["run"] = {
                ["challengeMapId"] = 999001,
                ["keystoneLevel"] = 10,
                ["affixIds"] = { [1] = 9 },
                ["startedAt"] = 1788300000,
                ["completedAt"] = 1788300060,
                ["durationMs"] = 60000,
                ["deathCount"] = 1,
                ["deathTimeLostMs"] = 15000,
                ["status"] = "completed"
            },
            ["encounters"] = {},
            ["player"] = { ["classId"] = 7, ["specId"] = 264, ["role"] = "HEALER", ["name"] = "Private Character" },
            ["group"] = {},
            ["privacy"] = { ["containsNames"] = false, ["containsChat"] = false },
            ["privateNote"] = "secret-two"
        },
        [2] = {
            ["schemaVersion"] = 1,
            ["recordType"] = "run-observation",
            ["collector"] = { ["name"] = "WHELP Collector", ["version"] = "0.2.0", ["token"] = "different-secret" },
            ["game"] = { ["version"] = "12.1.0", ["build"] = "69587", ["interfaceVersion"] = 120100 },
            ["run"] = {
                ["challengeMapId"] = 999001,
                ["keystoneLevel"] = 10,
                ["affixIds"] = { [1] = 9 },
                ["startedAt"] = 1788300000,
                ["completedAt"] = 1788300060,
                ["durationMs"] = 60000,
                ["deathCount"] = 1,
                ["deathTimeLostMs"] = 15000,
                ["status"] = "completed"
            },
            ["encounters"] = {},
            ["player"] = { ["classId"] = 7, ["specId"] = 264, ["role"] = "HEALER", ["name"] = "Another Private Character" },
            ["group"] = {},
            ["privacy"] = { ["containsNames"] = false, ["containsChat"] = false },
            ["privateNote"] = "secret-three"
        }
    }
}
