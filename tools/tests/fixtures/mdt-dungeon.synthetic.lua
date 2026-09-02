local _, MDT = ...
local dungeonIndex = 999
MDT.mapInfo[dungeonIndex] = {
  teleportId = 123456,
  englishName = "Synthetic Dungeon",
  mapID = 987,
}
local zones = { 1001, 1002 }
MDT.dungeonTotalCount[dungeonIndex] = { normal = 42 }
MDT.dungeonEnemies[dungeonIndex] = {
  [1] = {
    ["name"] = "Synthetic Caster",
    ["id"] = 900001,
    ["count"] = 7,
    ["clones"] = {
      [1] = {
        ["encounterID"] = 7654,
        ["instanceID"] = 8765,
        ["x"] = 123.5,
        ["y"] = -45.25,
        ["g"] = 9,
        ["sublevel"] = 2,
      },
    },
    ["spells"] = {
      [800001] = {
        ["interruptible"] = true,
        ["poison"] = true,
      },
    },
  },
}
