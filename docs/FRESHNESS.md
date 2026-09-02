# Source freshness

WHELP separates game-build validity from source freshness. A record can still be valid across builds while the evidence supporting it grows old, and a newly retrieved source cannot make an expired build range current.

The policy in `data/policies/source-freshness.json` defines age limits by provenance kind. Evidence becomes `aging` at 75% of its limit and `stale` after the limit. The report also identifies required timestamps that are missing, timestamps later than the evaluation time, and records whose build range is future or expired.

Run the default review queue:

```bash
npm run query:freshness
```

Run a reproducible historical audit or include every evaluated record:

```bash
npm run query:freshness -- --as-of 2026-09-02 --include all
```

`evidenceStatus` is based on the freshest usable source for a record. Individual stale sources remain visible in `sources` and in `sourceStatusCounts`, so corroboration by a newer source does not erase maintenance debt. `buildStatus` is evaluated independently as `current`, `carried-forward`, `expired`, `future`, or `not-versioned`.

The validator requires timestamps for volatile provenance kinds. A record-level field such as `observedAt` is accepted only when the policy declares it as a fallback. Generated records must propagate input retrieval times rather than inventing the current time.

Freshness is a review signal, not proof that a fact is correct. Source authority, record status, contradictory evidence, and the fact/strategy/observation boundary still apply.
