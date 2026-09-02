import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { querySourceClaims, summarizeSourceClaims } from "../lib/source-claim-query.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const audits = await Promise.all([
  "evoker-midnight-season-2-wowhead-dungeon-tips.json",
  "evoker-midnight-season-2-wowhead-cross-dungeon-sections.json",
  "restoration-shaman-midnight-season-2-wowhead-dungeon-tips.json",
].map(async (file) => JSON.parse(await readFile(path.join(root, "data", "source-audits", file), "utf8"))));

test("claim audit exposes rejected and unresolved source assertions", () => {
  assert.deepEqual(summarizeSourceClaims(audits), {
    auditCount: 3,
    claimCount: 58,
    byDisposition: { accepted: 29, "rejected-cross-dungeon": 28, unresolved: 1 },
  });
  assert.equal(querySourceClaims(audits, { dungeonId: "maisara-caverns" }).length, 5);
  assert.equal(querySourceClaims(audits, { dungeonId: "windrunner-spire" }).length, 4);
  assert.equal(querySourceClaims(audits, { dungeonId: "algethar-academy" }).length, 5);
  assert.equal(querySourceClaims(audits, { spellId: 1281636 })[0].canonicalDungeonId, "nexus-point-xenas");
  assert.equal(querySourceClaims(audits, { disposition: "unresolved" })[0].subjectName, "Dreadbellow");
});

test("Restoration Shaman accepted claims span every seasonal dungeon", () => {
  const accepted = querySourceClaims(audits, { disposition: "accepted" });
  assert.equal(accepted.length, 29);
  assert.deepEqual(
    [...new Set(accepted.map(({ canonicalDungeonId }) => canonicalDungeonId))].sort(),
    ["altar-of-fangs", "den-of-nalorakk", "kings-rest", "murder-row", "ruby-life-pools", "temple-of-sethraliss", "the-blinding-vale", "voidscar-arena"],
  );
  assert.equal(querySourceClaims(audits, { spellId: 1217973 })
    .some(({ disposition, canonicalDungeonId }) => disposition === "accepted" && canonicalDungeonId === "murder-row"), true);
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
  assert.throws(() => querySourceClaims(audits, { disposition: "verified" }), /disposition/);
  assert.throws(() => querySourceClaims(audits, { spellId: "not-an-id" }), /positive integer/);
  assert.throws(() => querySourceClaims([{ recordType: "strategy-note" }]), /source-claim-audit/);
});

test("Evoker matrices use canonical Murder Row and Voidscar response evidence", async () => {
  for (const spec of ["augmentation", "devastation"]) {
    const matrix = JSON.parse(await readFile(path.join(root, "content", "mythic-plus", "midnight-season-2", "specs", `${spec}-evoker-utility-matrix.json`), "utf8"));
    const murder = matrix.dungeons.find(({ dungeonId }) => dungeonId === "murder-row");
    assert.equal(murder.ratings["toxin-cleanse"], "always");
    assert.deepEqual(murder.mechanicSpellIds, [1214922, 1216590, 1217973]);
    const voidscar = matrix.dungeons.find(({ dungeonId }) => dungeonId === "voidscar-arena");
    assert.equal(voidscar.ratings["toxin-cleanse"], "always");
    assert.equal(voidscar.ratings["multi-cleanse"], "none");
    assert.deepEqual(voidscar.mechanicSpellIds, [1249621, 1289258, 1310319]);
  }
});
