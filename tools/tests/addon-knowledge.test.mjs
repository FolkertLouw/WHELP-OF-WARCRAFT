import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { compileAddonKnowledge } from "../lib/addon-knowledge.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");

async function records() {
  const season = JSON.parse(await readFile(path.join(root, "data", "seasons", "midnight-season-2.json"), "utf8"));
  const index = JSON.parse(await readFile(path.join(root, "data", "index.json"), "utf8"));
  const wanted = new Set(season.dungeons.map((dungeon) => dungeon.id));
  const dungeons = await Promise.all(index.dungeons
    .filter((entry) => wanted.has(entry.id))
    .map((entry) => readFile(path.join(root, "data", entry.record), "utf8").then(JSON.parse)));
  return { season, dungeons };
}

test("keeps generated addon enemy-forces knowledge reproducible", async () => {
  const generated = await readFile(path.join(root, "addon", "WHELPCollector", "GeneratedKnowledge", "EnemyForces.lua"), "utf8");
  assert.equal(compileAddonKnowledge(await records()), generated);
  assert.match(generated, /dataBuild = "12\.1\.0\.69587"/);
  assert.match(generated, /datasetHash = "[a-f0-9]{64}"/);
  assert.equal([...generated.matchAll(/^        \[\d+\] = \{$/gm)].length, 8);
});

test("rejects a season-to-dungeon build mismatch", async () => {
  const input = await records();
  input.dungeons[0] = {
    ...input.dungeons[0],
    validity: { ...input.dungeons[0].validity, fromBuild: "12.1.0.00000" },
  };
  assert.throws(() => compileAddonKnowledge(input), /build mismatch/);
});

test("loads generated knowledge before pull tracking in the addon manifest", async () => {
  const toc = await readFile(path.join(root, "addon", "WHELPCollector", "WHELPCollector.toc"), "utf8");
  const entries = toc.split(/\r?\n/).filter((line) => line.endsWith(".lua"));
  assert.ok(entries.indexOf("GeneratedKnowledge\\EnemyForces.lua") < entries.indexOf("PullTracker.lua"));
  assert.ok(entries.indexOf("PullTracker.lua") < entries.indexOf("Collector.lua"));
  for (const entry of entries) {
    await readFile(path.join(root, "addon", "WHELPCollector", ...entry.split("\\")), "utf8");
  }
});

test("keeps package and addon versions aligned", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const toc = await readFile(path.join(root, "addon", "WHELPCollector", "WHELPCollector.toc"), "utf8");
  const namespace = await readFile(path.join(root, "addon", "WHELPCollector", "Namespace.lua"), "utf8");
  assert.match(toc, new RegExp(`^## Version: ${packageJson.version.replaceAll(".", "\\.")}$`, "m"));
  assert.match(namespace, new RegExp(`WHELP\\.version = "${packageJson.version.replaceAll(".", "\\.")}"`));
});
