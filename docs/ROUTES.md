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

Run observations may declare a `routePlanId` and privacy-safe observed pull summaries. This supports comparisons such as planned versus actual pull duration, death concentration, count drift, and boss checkpoint pacing without collecting player names or chat. Route assignment can be added during local import when the addon could not identify it in game.
