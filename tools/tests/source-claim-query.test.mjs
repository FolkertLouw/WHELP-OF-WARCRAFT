import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { querySourceClaims, summarizeSourceClaims } from "../lib/source-claim-query.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const audits = await Promise.all([
  "evoker-midnight-season-2-wowhead-dungeon-tips.json",
  "evoker-midnight-season-2-wowhead-cross-dungeon-sections.json",
  "elemental-shaman-midnight-season-2-wowhead-placeholders.json",
  "elemental-shaman-midnight-season-2-wowhead-utility-mentions.json",
  "enhancement-shaman-midnight-season-2-wowhead-utility-ratings.json",
  "restoration-shaman-midnight-season-2-wowhead-dungeon-tips.json",
].map(async (file) => JSON.parse(await readFile(path.join(root, "data", "source-audits", file), "utf8"))));

test("claim audit exposes rejected and unresolved source assertions", () => {
  assert.deepEqual(summarizeSourceClaims(audits), {
    auditCount: 6,
    claimCount: 144,
    byDisposition: { accepted: 106, "rejected-cross-dungeon": 28, "rejected-placeholder": 9, unresolved: 1 },
  });
  assert.equal(querySourceClaims(audits, { dungeonId: "maisara-caverns" }).length, 5);
  assert.equal(querySourceClaims(audits, { dungeonId: "windrunner-spire" }).length, 4);
  assert.equal(querySourceClaims(audits, { dungeonId: "algethar-academy" }).length, 5);
  assert.equal(querySourceClaims(audits, { spellId: 1281636 })[0].canonicalDungeonId, "nexus-point-xenas");
  assert.equal(querySourceClaims(audits, { disposition: "unresolved" })[0].subjectName, "Dreadbellow");
});

test("Elemental utility mentions bind to non-none axes without inventing ratings", async () => {
  const mentions = querySourceClaims(audits, { claimType: "utility-mention", specSlug: "elemental-shaman" });
  assert.equal(mentions.length, 37);
  assert.equal(mentions.every(({ assertedRating }) => assertedRating === undefined), true);
  const matrix = JSON.parse(await readFile(path.join(root, "content", "mythic-plus", "midnight-season-2", "specs", "elemental-shaman-utility-matrix.json"), "utf8"));
  for (const dungeonId of ["voidscar-arena", "kings-rest"]) {
    assert.equal(matrix.dungeons.find((dungeon) => dungeon.dungeonId === dungeonId).ratings["root-removal"], "none");
    assert.equal(querySourceClaims(audits, { claimType: "utility-mention", specSlug: "elemental-shaman", dungeonId, axisId: "root-removal" }).length, 0);
  }
});

test("Enhancement utility-rating claims reproduce the complete guide grid", () => {
  const ratings = querySourceClaims(audits, { claimType: "utility-rating", specSlug: "enhancement-shaman" });
  assert.equal(ratings.length, 40);
  assert.equal(querySourceClaims(audits, { specSlug: "enhancement-shaman", dungeonId: "voidscar-arena", axisId: "root-removal" })[0].assertedRating, "always");
  assert.equal(querySourceClaims(audits, { specSlug: "enhancement-shaman", dungeonId: "voidscar-arena", axisId: "purge" })[0].assertedRating, "none");
});

test("Elemental authoring placeholders are queryable and never accepted", () => {
  const placeholders = querySourceClaims(audits, { claimType: "placeholder" });
  assert.equal(placeholders.length, 9);
  assert.equal(placeholders.every(({ disposition, canonicalDungeonId }) => disposition === "rejected-placeholder" && canonicalDungeonId === null), true);
  assert.equal(querySourceClaims(audits, { disposition: "rejected-placeholder", dungeonId: "murder-row" })[0].subjectName, "MURDER_TIPS");
  assert.equal(placeholders.some(({ subjectName }) => subjectName === "Platform Despawn Nudge Trigger"), true);
  assert.equal(placeholders.some(({ subjectName }) => subjectName === "Ship Spawned"), true);
});

test("Restoration Shaman accepted claims span every seasonal dungeon", () => {
  const accepted = querySourceClaims(audits, { disposition: "accepted", claimType: "mechanic-location" });
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
  assert.throws(() => querySourceClaims(audits, { claimType: "template-ish" }), /claimType/);
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
