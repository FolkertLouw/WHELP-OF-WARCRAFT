import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseMdtDungeon } from "./lib/mdt-parser.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const mdtRoot = valueAfter("--mdt-root");
if (!mdtRoot) {
  console.error("Usage: npm run import:season-mdt -- --mdt-root <MythicDungeonTools/Midnight>");
  process.exit(2);
}

const manifestPath = path.join(root, "sources", "imports", "midnight-season-2-dungeons.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const retrievedAt = "2026-09-02T11:15:00+02:00";
const validity = { fromBuild: manifest.build, untilBuild: null, seasonId: null, seasonSlug: manifest.seasonSlug };

function dispelType(spell) {
  for (const type of ["poison", "disease", "curse", "magic"]) if (spell[type]) return type;
  return "none";
}

for (const configured of manifest.dungeons) {
  const parsed = parseMdtDungeon(await readFile(path.join(mdtRoot, configured.mdtFile), "utf8"));
  const enemies = parsed.enemies.map((enemy) => ({ name: enemy.name, npcId: enemy.npcId, enemyForces: enemy.enemyForces }));
  const knownNpcIds = new Set(enemies.map((enemy) => enemy.npcId));
  for (const encounter of configured.encounters) {
    if (!knownNpcIds.has(encounter.npcId)) enemies.push({ name: encounter.name, npcId: encounter.npcId, enemyForces: 0 });
  }
  const provenance = [{
    kind: "game-data",
    description: `Dungeon, NPC, enemy-forces, map, teleport, zone, and spell-flag facts derived from Mythic Dungeon Tools ${manifest.mdtVersion}.`,
    url: "https://github.com/Nnoggie/MythicDungeonTools",
    retrievedAt,
  }, {
    kind: "external-reference",
    description: `Instance, encounter, and boss NPC identifiers corroborated against DBM Dungeons ${manifest.dbmVersion}.`,
    url: "https://github.com/DeadlyBossMods/DBM-Dungeons",
    retrievedAt,
  }];
  const dungeon = {
    $schema: "../../../schemas/dungeon.schema.json", schemaVersion: 1, recordType: "dungeon",
    id: configured.slug, status: "corroborated", name: parsed.name, expansion: configured.expansion,
    validity, challengeMapId: parsed.challengeMapId, instanceMapId: configured.instanceMapId,
    teleportSpellId: parsed.teleportSpellId, uiMapId: null, zoneIds: parsed.zoneIds,
    enemyForcesTotal: parsed.enemyForcesTotal, mythicPlusTimerSeconds: null, requiredLevel: null,
    location: null, entrance: null, encounters: configured.encounters, enemies, provenance,
  };
  const abilityEnemies = parsed.enemies.map((enemy) => ({
    name: enemy.name, npcId: enemy.npcId,
    abilities: enemy.spells.filter((spell) => spell.interruptible || spell.poison || spell.disease || spell.curse || spell.magic || spell.enrage)
      .map((spell) => ({ spellId: spell.spellId, name: null, interruptible: spell.interruptible, dispelType: dispelType(spell), enrage: spell.enrage })),
  })).filter((enemy) => enemy.abilities.length);
  const abilities = {
    $schema: "../../../schemas/enemy-abilities.schema.json", schemaVersion: 1, recordType: "enemy-abilities",
    id: `${configured.slug}/enemy-abilities`, status: "draft", validity, instanceMapId: configured.instanceMapId,
    enemies: abilityEnemies,
    provenance: [{ kind: "game-data", description: `Ability flags extracted by WHELP from Mythic Dungeon Tools ${manifest.mdtVersion}; names remain null until independently corroborated.`, url: "https://github.com/Nnoggie/MythicDungeonTools", retrievedAt }],
  };
  const output = path.join(root, "data", "dungeons", configured.slug);
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "dungeon.json"), `${JSON.stringify(dungeon, null, 2)}\n`);
  await writeFile(path.join(output, "enemy-abilities.json"), `${JSON.stringify(abilities, null, 2)}\n`);
  console.log(`${configured.slug}: ${enemies.length} enemies, ${abilityEnemies.reduce((count, enemy) => count + enemy.abilities.length, 0)} flagged abilities`);
}
