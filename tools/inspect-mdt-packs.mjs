import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseMdtDungeon } from "./lib/mdt-parser.mjs";

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error("Usage: node tools/inspect-mdt-packs.mjs <MDT dungeon Lua file>");
  process.exit(1);
}

const dungeon = parseMdtDungeon(await readFile(path.resolve(sourcePath), "utf8"));
const packs = new Map();
for (const enemy of dungeon.enemies) {
  for (const clone of enemy.clones) {
    const packId = clone.groupId === null ? `ungrouped-${enemy.npcId}-${clone.cloneIndex}` : `group-${clone.groupId}`;
    if (!packs.has(packId)) packs.set(packId, { packId, groupId: clone.groupId, sublevel: clone.sublevel, enemies: [] });
    packs.get(packId).enemies.push({
      npcId: enemy.npcId,
      name: enemy.name,
      cloneIndex: clone.cloneIndex,
      x: clone.x,
      y: clone.y,
      enemyForces: enemy.enemyForces,
    });
  }
}

const normalized = [...packs.values()].map((pack) => ({
  ...pack,
  enemyForces: pack.enemies.reduce((total, enemy) => total + enemy.enemyForces, 0),
}));
console.log(JSON.stringify({
  sourceFormat: dungeon.sourceFormat,
  dungeon: dungeon.name,
  challengeMapId: dungeon.challengeMapId,
  requiredEnemyForces: dungeon.enemyForcesTotal,
  availableEnemyForces: normalized.reduce((total, pack) => total + pack.enemyForces, 0),
  packs: normalized,
}, null, 2));
