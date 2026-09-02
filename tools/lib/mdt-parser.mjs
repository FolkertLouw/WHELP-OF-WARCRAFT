function balancedTable(source, marker, startAt = 0) {
  const markerIndex = source.indexOf(marker, startAt);
  if (markerIndex < 0) throw new Error(`Missing MDT section: ${marker}`);
  const open = source.indexOf("{", markerIndex + marker.length);
  if (open < 0) throw new Error(`Missing table after MDT section: ${marker}`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "-" && next === "-") {
      lineComment = true;
      index += 1;
    } else if (character === "\"" || character === "'") quote = character;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  throw new Error(`Unclosed MDT table: ${marker}`);
}

function integer(source, pattern, label, optional = false) {
  const match = source.match(pattern);
  if (!match) {
    if (optional) return null;
    throw new Error(`Missing ${label}`);
  }
  return Number(match[1]);
}

function numberValue(source, pattern) {
  const match = source.match(pattern);
  return match ? Number(match[1]) : null;
}

function stringValue(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`Missing ${label}`);
  return match[1];
}

function numberedEntries(tableSource, indentation) {
  const expression = new RegExp(`^ {${indentation}}\\[(\\d+)\\] = \\{`, "gm");
  const entries = [];
  for (const match of tableSource.matchAll(expression)) {
    const marker = match[0].slice(0, -1);
    entries.push({ index: Number(match[1]), body: balancedTable(tableSource, marker, match.index) });
  }
  return entries;
}

function parseSpells(enemyBody) {
  let spellsBody;
  try {
    spellsBody = balancedTable(enemyBody, '["spells"] =');
  } catch {
    return [];
  }
  return numberedEntries(spellsBody, 6).map(({ index: spellId, body }) => ({
    spellId,
    interruptible: /\["interruptible"\]\s*=\s*true/.test(body),
    poison: /\["poison"\]\s*=\s*true/.test(body),
    disease: /\["disease"\]\s*=\s*true/.test(body),
    curse: /\["curse"\]\s*=\s*true/.test(body),
    magic: /\["magic"\]\s*=\s*true/.test(body),
    enrage: /\["enrage"\]\s*=\s*true/.test(body),
  }));
}

function parseClones(enemyBody) {
  let clonesBody;
  try {
    clonesBody = balancedTable(enemyBody, '["clones"] =');
  } catch {
    return [];
  }
  return numberedEntries(clonesBody, 6).map(({ index: cloneIndex, body }) => ({
    cloneIndex,
    groupId: integer(body, /\["g"\]\s*=\s*(\d+)/, "clone group", true),
    sublevel: integer(body, /\["sublevel"\]\s*=\s*(\d+)/, "clone sublevel", true) ?? 1,
    x: numberValue(body, /\["x"\]\s*=\s*(-?\d+(?:\.\d+)?)/),
    y: numberValue(body, /\["y"\]\s*=\s*(-?\d+(?:\.\d+)?)/),
  }));
}

export function parseMdtDungeon(source) {
  const dungeonIndex = integer(source, /local dungeonIndex\s*=\s*(\d+)/, "dungeonIndex");
  const mapInfo = balancedTable(source, "MDT.mapInfo[dungeonIndex] =");
  const zonesBody = balancedTable(source, "local zones =");
  const totalCountBody = balancedTable(source, "MDT.dungeonTotalCount[dungeonIndex] =");
  const enemiesBody = balancedTable(source, "MDT.dungeonEnemies[dungeonIndex] =");

  const enemies = numberedEntries(enemiesBody, 2).map(({ body }) => ({
    name: stringValue(body, /\["name"\]\s*=\s*"([^"]+)"/, "enemy name"),
    npcId: integer(body, /\["id"\]\s*=\s*(\d+)/, "enemy id"),
    enemyForces: integer(body, /\["count"\]\s*=\s*(\d+)/, "enemy forces"),
    sourceEncounterId: integer(body, /\["encounterID"\]\s*=\s*(\d+)/, "encounterID", true),
    sourceInstanceId: integer(body, /\["instanceID"\]\s*=\s*(\d+)/, "instanceID", true),
    spells: parseSpells(body),
    clones: parseClones(body),
  }));

  return {
    sourceFormat: "mythic-dungeon-tools-lua",
    dungeonIndex,
    name: stringValue(mapInfo, /englishName\s*=\s*"([^"]+)"/, "englishName"),
    challengeMapId: integer(mapInfo, /mapID\s*=\s*(\d+)/, "mapID"),
    teleportSpellId: integer(mapInfo, /teleportId\s*=\s*(\d+)/, "teleportId", true),
    zoneIds: [...zonesBody.matchAll(/\b(\d+)\b/g)].map((match) => Number(match[1])),
    enemyForcesTotal: integer(totalCountBody, /normal\s*=\s*(\d+)/, "enemy forces total"),
    enemies,
  };
}
