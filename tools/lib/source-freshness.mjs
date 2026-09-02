import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DAY_MS = 86_400_000;
const sourceRank = new Map([["fresh", 0], ["aging", 1], ["stale", 2], ["undated", 3], ["untracked", 4]]);

function buildParts(value) {
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+\.\d+$/.test(value)) return null;
  return value.split(".").map(Number);
}

export function compareBuilds(left, right) {
  const a = buildParts(left);
  const b = buildParts(right);
  if (!a || !b) throw new Error(`invalid build comparison ${left} / ${right}`);
  for (let index = 0; index < 4; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

export function classifyBuild(validity, currentBuild) {
  if (!validity?.fromBuild) return "not-versioned";
  if (compareBuilds(currentBuild, validity.fromBuild) < 0) return "future";
  if (validity.untilBuild && compareBuilds(currentBuild, validity.untilBuild) > 0) return "expired";
  return compareBuilds(currentBuild, validity.fromBuild) === 0 ? "current" : "carried-forward";
}

function sourceTimestamp(source, record, policy) {
  if (source.retrievedAt) return { value: source.retrievedAt, origin: "retrievedAt" };
  for (const field of policy.timestampFallbackFields ?? []) {
    if (record[field]) return { value: record[field], origin: field };
  }
  return null;
}

export function classifySource(source, record, policy, asOf) {
  const maximumAgeDays = policy.maxAgeDaysByKind[source.kind] ?? null;
  const timestamp = sourceTimestamp(source, record, policy);
  if (!timestamp) {
    const required = (policy.timestampRequiredKinds ?? []).includes(source.kind);
    return { kind: source.kind, status: required ? "undated" : "untracked", ageDays: null, maximumAgeDays, timestamp: null, timestampOrigin: null };
  }
  const retrieved = new Date(timestamp.value);
  if (Number.isNaN(retrieved.valueOf())) throw new Error(`invalid provenance timestamp ${timestamp.value}`);
  const ageDays = Math.floor((asOf.valueOf() - retrieved.valueOf()) / DAY_MS);
  if (ageDays < 0) return { kind: source.kind, status: "future-dated", ageDays, maximumAgeDays, timestamp: timestamp.value, timestampOrigin: timestamp.origin };
  if (maximumAgeDays === null) return { kind: source.kind, status: "untracked", ageDays, maximumAgeDays, timestamp: timestamp.value, timestampOrigin: timestamp.origin };
  const agingAtDays = Math.floor(maximumAgeDays * policy.agingAtFraction);
  const status = ageDays > maximumAgeDays ? "stale" : ageDays >= agingAtDays ? "aging" : "fresh";
  return { kind: source.kind, status, ageDays, maximumAgeDays, timestamp: timestamp.value, timestampOrigin: timestamp.origin };
}

export function compileFreshnessReport({ records, policy, currentBuild, asOf = new Date() }) {
  if (!(asOf instanceof Date) || Number.isNaN(asOf.valueOf())) throw new Error("asOf must be a valid Date");
  const results = records.map(({ path, record }) => {
    const sources = (record.provenance ?? []).map((source) => classifySource(source, record, policy, asOf));
    const usable = sources.filter((source) => source.status !== "future-dated");
    const evidenceStatus = usable.length
      ? [...usable].sort((left, right) => sourceRank.get(left.status) - sourceRank.get(right.status))[0].status
      : sources.length ? "future-dated" : "absent";
    const buildStatus = classifyBuild(record.validity, currentBuild);
    const needsReview = ["stale", "undated", "untracked", "future-dated", "absent"].includes(evidenceStatus)
      || ["future", "expired"].includes(buildStatus);
    return { path, recordType: record.recordType, recordId: record.id ?? null, status: record.status ?? null, buildStatus, evidenceStatus, needsReview, sources };
  }).sort((left, right) => left.path.localeCompare(right.path));

  const countBy = (field) => Object.fromEntries([...new Set(results.map((record) => record[field]))].sort()
    .map((value) => [value, results.filter((record) => record[field] === value).length]));
  const sourceStatuses = results.flatMap((record) => record.sources.map((source) => source.status));
  return {
    schemaVersion: 1,
    policyId: policy.id,
    currentBuild,
    evaluatedAt: asOf.toISOString(),
    summary: {
      recordCount: results.length,
      sourceCount: sourceStatuses.length,
      needsReviewCount: results.filter((record) => record.needsReview).length,
      evidenceStatusCounts: countBy("evidenceStatus"),
      buildStatusCounts: countBy("buildStatus"),
      sourceStatusCounts: Object.fromEntries([...new Set(sourceStatuses)].sort().map((status) => [status, sourceStatuses.filter((value) => value === status).length]))
    },
    records: results
  };
}

async function walkJson(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkJson(target));
    else if (entry.name.endsWith(".json")) files.push(target);
  }
  return files;
}

export async function loadProvenanceRecords(root, policy) {
  const records = [];
  for (const relativeRoot of policy.evaluatedRoots) {
    const absoluteRoot = path.join(root, relativeRoot);
    for (const file of await walkJson(absoluteRoot)) {
      const record = JSON.parse(await readFile(file, "utf8"));
      if (!record.recordType || !Array.isArray(record.provenance)) continue;
      records.push({ path: path.relative(root, file).replaceAll("\\", "/"), record });
    }
  }
  return records;
}
