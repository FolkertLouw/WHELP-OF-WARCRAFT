const claimTypes = ["mechanic-location", "utility-rating", "utility-mention", "placeholder"];
const dispositions = ["accepted", "rejected-cross-dungeon", "rejected-placeholder", "unresolved"];

function specSlugFromGuideUrl(url) {
  const match = String(url).match(/\/guide\/classes\/([^/]+)\/([^/]+)\//);
  return match ? `${match[2]}-${match[1]}` : null;
}

function countBy(values, keys) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

export function buildSourceAuditCoverage(matrices, audits, { seasonSlug, currentBuild }) {
  if (!Array.isArray(matrices) || matrices.some((matrix) => matrix?.recordType !== "spec-dungeon-matrix")) {
    throw new TypeError("matrices must contain only spec-dungeon-matrix records");
  }
  if (!Array.isArray(audits) || audits.some((audit) => audit?.recordType !== "source-claim-audit")) {
    throw new TypeError("audits must contain only source-claim-audit records");
  }
  if (!seasonSlug || !currentBuild) throw new TypeError("seasonSlug and currentBuild are required");

  const retrievedAt = [...matrices, ...audits]
    .flatMap((record) => record.provenance ?? (record.source ? [record.source] : []))
    .map((source) => source.retrievedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  const entries = matrices.map((matrix) => {
    const specSlug = matrix.id.slice(`${seasonSlug}/`.length, -"-utility-matrix".length);
    const sourceUrls = [...new Set((matrix.provenance ?? [])
      .map((source) => source.url)
      .filter((url) => url && specSlugFromGuideUrl(url) === specSlug))].sort();
    const matchingAudits = audits.filter((audit) => {
      const explicitSlugs = new Set((audit.claims ?? []).map((claim) => claim.specSlug).filter(Boolean));
      return explicitSlugs.has(specSlug) || specSlugFromGuideUrl(audit.source?.url) === specSlug;
    });
    const claims = matchingAudits.flatMap((audit) => audit.claims ?? []);
    const allSourcesComplete = sourceUrls.length > 0 && sourceUrls.every((url) => matchingAudits
      .some((audit) => audit.source?.url === url && audit.coverageCompleteness === "complete"));
    const coverageLevel = !sourceUrls.length
      ? "no-source"
      : !matchingAudits.length
        ? "provenance-only"
        : allSourcesComplete ? "fully-audited" : "partially-audited";
    const limitations = coverageLevel === "fully-audited" ? []
      : coverageLevel === "partially-audited"
        ? ["Claim-level review exists, but no audit declares complete coverage of every relevant source section."]
        : coverageLevel === "provenance-only"
          ? ["The matrix cites a specialization guide, but WHELP has not created a claim-level audit for it yet."]
          : ["No specialization-guide source URL is recorded for this matrix."];
    return {
      specId: matrix.spec.specId,
      specSlug,
      matrixId: matrix.id,
      coverageLevel,
      sourceUrls,
      auditIds: matchingAudits.map((audit) => audit.id).sort(),
      claimCount: claims.length,
      claimsByType: countBy(claims.map((claim) => claim.claimType ?? "mechanic-location"), claimTypes),
      claimsByDisposition: countBy(claims.map((claim) => claim.disposition), dispositions),
      limitations,
    };
  }).sort((left, right) => left.specSlug.localeCompare(right.specSlug));

  const countLevel = (level) => entries.filter((entry) => entry.coverageLevel === level).length;
  return {
    $schema: "../../schemas/source-audit-coverage.schema.json",
    schemaVersion: 1,
    recordType: "source-audit-coverage",
    id: `${seasonSlug}/spec-source-audit-coverage`,
    status: "verified",
    validity: { fromBuild: currentBuild, untilBuild: null, seasonId: null, seasonSlug },
    isCatalogComplete: entries.length === matrices.length,
    summary: {
      specializationCount: entries.length,
      fullyAudited: countLevel("fully-audited"),
      partiallyAudited: countLevel("partially-audited"),
      provenanceOnly: countLevel("provenance-only"),
      noSource: countLevel("no-source"),
    },
    entries,
    missingAuditMeaning: "Provenance-only means a matrix has a linked source but its individual claims have not yet been audited; it must not be interpreted as independent claim-level verification.",
    provenance: [
      {
        kind: "curated",
        description: "Generated deterministically from all seasonal specialization matrices and indexed source-claim audits.",
        recordId: "data/index.json",
        ...(retrievedAt ? { retrievedAt } : {}),
      }
    ]
  };
}

export function querySourceAuditCoverage(coverage, filters = {}) {
  if (coverage?.recordType !== "source-audit-coverage") throw new TypeError("coverage must be a source-audit-coverage record");
  const allowed = new Set(["fully-audited", "partially-audited", "provenance-only", "no-source"]);
  if (filters.level && !allowed.has(filters.level)) throw new TypeError("level must be fully-audited, partially-audited, provenance-only, or no-source");
  return coverage.entries.filter((entry) => (!filters.level || entry.coverageLevel === filters.level)
    && (!filters.specSlug || entry.specSlug === filters.specSlug));
}
