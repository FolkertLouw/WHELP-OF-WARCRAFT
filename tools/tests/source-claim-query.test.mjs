import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { querySourceClaims, summarizeSourceClaims } from "../lib/source-claim-query.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const audit = JSON.parse(await readFile(path.join(root, "data", "source-audits", "evoker-midnight-season-2-wowhead-dungeon-tips.json"), "utf8"));

test("claim audit exposes rejected and unresolved source assertions", () => {
  assert.deepEqual(summarizeSourceClaims([audit]), {
    auditCount: 1,
    claimCount: 8,
    byDisposition: { accepted: 0, "rejected-cross-dungeon": 7, unresolved: 1 },
  });
  assert.equal(querySourceClaims([audit], { dungeonId: "maisara-caverns" }).length, 5);
  assert.equal(querySourceClaims([audit], { spellId: 1281636 })[0].canonicalDungeonId, "nexus-point-xenas");
  assert.equal(querySourceClaims([audit], { disposition: "unresolved" })[0].subjectName, "Dreadbellow");
});

test("Evoker matrices cannot reintroduce rejected Blinding Vale claims", async () => {
  for (const spec of ["augmentation", "devastation", "preservation"]) {
    const matrix = JSON.parse(await readFile(path.join(root, "content", "mythic-plus", "midnight-season-2", "specs", `${spec}-evoker-utility-matrix.json`), "utf8"));
    const vale = matrix.dungeons.find(({ dungeonId }) => dungeonId === "the-blinding-vale");
    assert.equal(vale.ratings["multi-cleanse"], "none");
    assert.equal(vale.ratings.soothe, "none");
    for (const rejected of [1266480, 1246666, 1255765, 1256047, 1259887]) {
      assert.equal(vale.mechanicSpellIds.includes(rejected), false);
    }
  }
});

test("claim queries reject invalid filters instead of returning deceptive empty output", () => {
  assert.throws(() => querySourceClaims([audit], { disposition: "verified" }), /disposition/);
  assert.throws(() => querySourceClaims([audit], { spellId: "not-an-id" }), /positive integer/);
  assert.throws(() => querySourceClaims([{ recordType: "strategy-note" }]), /source-claim-audit/);
});
