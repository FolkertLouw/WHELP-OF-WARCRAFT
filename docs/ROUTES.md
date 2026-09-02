# Route records

WHELP route records are executable plans, not screenshots or prose descriptions. A route identifies its canonical dungeon, intended use, build range, ordered pulls, per-pull enemy forces, cumulative forces, and provenance. Stable pull IDs let an observation or comparison report refer to the same planned segment without relying on localized names.

## Import boundary

`npm run inspect:mdt-packs -- <dungeon Lua file>` extracts MDT clone positions and pack-group identifiers as review evidence. Those identifiers are source-local hints, not permanent WHELP IDs. A curator must decide which static groups belong in a route and whether they are combined, skipped, or split.

Do not generate a route by summing every clone. MDT map modules can contain bosses, summoned adds, encounter objects, and other zero- or non-route entities. In the installed Retail MDT 6.2.10 King's Rest module reviewed on 2026-09-02, the dungeon requires 608 enemy forces while a naïve sum of all positive-count clones is 661. This mismatch is evidence that spawn extraction and route selection are separate operations.

## Validation invariants

A publishable route must satisfy all of these checks:

- `dungeonId`, challenge map, and instance map resolve to the same canonical dungeon record.
- Pull IDs are unique and pull order is contiguous.
- Every NPC exists in that dungeon's versioned roster.
- The route's per-NPC enemy-forces value matches the canonical dungeon value.
- Each pull subtotal and cumulative total recompute exactly.
- The final target meets or exceeds the dungeon's required enemy forces.
- Encounter checkpoints resolve to known encounters.
- The route declares its use case, key range when applicable, build validity, status, and provenance.

Passing structural validation does not make a route strategically good. Imported and newly curated routes remain `draft` until reviewed against current live runs. Individual run observations remain evidence; they never overwrite the route automatically.

## Observation linkage

Run observations may declare a `routePlanId` and privacy-safe observed pull summaries. Each observed pull should use `plannedPullId` when the collector or local importer can identify its planned segment. An observation with a planned pull ID must also name its route, and a planned pull may be linked only once per observation. When an exact link is unavailable, comparison can fall back to pull order, but the result is marked as inferred because a live group may split, merge, skip, or reorder packs.

To create a machine-readable comparison report:

```text
npm run compare:route -- --route <route.json> --observation <run-observation.json>
```

The versioned report includes its game build, key level, affixes, collector version, pull matching quality, missing and extra pulls, enemy-count and enemy-forces drift, duration and death attribution, plus observed boss checkpoint timing. It is written to standard output so a local ingestion service can save or aggregate it without adding raw telemetry to Git. Its contract is `schemas/route-run-comparison.schema.json`.

Public observation validation checks route and dungeon identity, planned pull IDs, NPC membership, recomputed enemy forces, contiguous ordering, timestamp-derived durations, encounter IDs, and death attribution. These checks catch internally inconsistent or incorrectly linked records; they cannot prove that a locally edited observation reflects a real run.
