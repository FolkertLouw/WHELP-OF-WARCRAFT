export function querySourceClaims(audits, filters = {}) {
  if (!Array.isArray(audits) || audits.some((audit) => audit?.recordType !== "source-claim-audit")) {
    throw new TypeError("audits must contain only WHELP source-claim-audit records");
  }
  const selectedDispositions = filters.disposition
    ? (Array.isArray(filters.disposition) ? filters.disposition : [filters.disposition])
    : null;
  const allowedDispositions = new Set(["accepted", "rejected-cross-dungeon", "rejected-placeholder", "unresolved"]);
  if (selectedDispositions?.some((disposition) => !allowedDispositions.has(disposition))) {
    throw new TypeError("disposition must be accepted, rejected-cross-dungeon, rejected-placeholder, or unresolved");
  }
  const dispositions = selectedDispositions
    ? new Set(selectedDispositions)
    : null;
  const dungeonId = filters.dungeonId ?? null;
  const claimType = filters.claimType ?? null;
  const specSlug = filters.specSlug ?? null;
  const axisId = filters.axisId ?? null;
  if (claimType && !["mechanic-location", "utility-rating", "utility-mention", "placeholder"].includes(claimType)) {
    throw new TypeError("claimType must be mechanic-location, utility-rating, utility-mention, or placeholder");
  }
  const spellId = filters.spellId === undefined ? null : Number(filters.spellId);
  if (spellId !== null && (!Number.isInteger(spellId) || spellId < 1)) {
    throw new TypeError("spellId must be a positive integer");
  }

  return audits.flatMap((audit) => (audit.claims ?? []).flatMap((claim) => {
    if (dispositions && !dispositions.has(claim.disposition)) return [];
    if (dungeonId && claim.assertedDungeonId !== dungeonId && claim.canonicalDungeonId !== dungeonId) return [];
    if (claimType && (claim.claimType ?? "mechanic-location") !== claimType) return [];
    if (specSlug && claim.specSlug !== specSlug) return [];
    if (axisId && claim.axisId !== axisId) return [];
    if (spellId !== null && claim.spellId !== spellId) return [];
    return [{
      auditId: audit.id,
      sourceTitle: audit.source.title,
      sourceUrl: audit.source.url,
      ...claim,
    }];
  }));
}

export function summarizeSourceClaims(audits) {
  const claims = querySourceClaims(audits);
  const byDisposition = { accepted: 0, "rejected-cross-dungeon": 0, "rejected-placeholder": 0, unresolved: 0 };
  for (const claim of claims) byDisposition[claim.disposition] = (byDisposition[claim.disposition] ?? 0) + 1;
  return { auditCount: audits.length, claimCount: claims.length, byDisposition };
}
