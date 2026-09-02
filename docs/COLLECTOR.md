# WHELP Collector

WHELP Collector is an opt-in, local-only Retail addon. It records anonymous Mythic+ run summaries and never uploads data. The SavedVariables importer is the explicit boundary between the private game client and any sanitized export.

## Pull telemetry in Patch 12

Patch 12 restricts unit identity and some combat-time values. WHELP therefore does not register `COMBAT_LOG_EVENT_UNFILTERED`, retain GUIDs, infer enemies from names, or call per-unit criteria APIs. Those approaches would either be unsafe under secret-value rules or create data the addon cannot honestly verify.

The collector uses `PLAYER_REGEN_DISABLED` and `PLAYER_REGEN_ENABLED` as pull boundaries. At each boundary it reads `C_ScenarioInfo.GetScenarioStepInfo()` and searches `C_ScenarioInfo.GetCriteriaInfo()` for a weighted-progress criterion. It accepts that criterion only when its `totalQuantity` equals the current dungeon's build-stamped `enemyForcesTotal` in generated WHELP knowledge. The difference between start and end `quantity` is stored as banked enemy forces.

Every recorded pull declares:

- `enemyForcesSource`: `scenario-progress` or `unavailable`;
- the start and end banked-force snapshots;
- `enemyIdentityStatus: unavailable-secret-values`;
- a death-count delta from the challenge-mode API;
- wall-clock start, end, and duration.

This is deliberately progress-only telemetry. It cannot identify which mobs were engaged, cannot calculate the unbanked value of living enemies, and may split or merge pulls differently from a route when the player briefly leaves combat or joins late. Successful zero-count combat segments are retained so bosses remain visible by order; encounter records provide the stronger boss checkpoint identity.

## Build gating

The checked-in `GeneratedKnowledge/EnemyForces.lua` is compiled from the canonical season and dungeon records:

```text
npm run generate:addon-knowledge
```

The output contains numeric challenge-map IDs, instance-map IDs, required forces, and NPC-to-forces lookups without localized names. It embeds a SHA-256 dataset hash that is copied into observations as `knowledgeRevision`. Generation fails when a seasonal dungeon is absent, its challenge-map ID disagrees, or its build range differs from the season. A reproducibility test requires the checked-in Lua to match current JSON exactly.

At runtime, scenario-progress collection is enabled only when the game version and build equal the generated `dataBuild` and the active challenge map is known. Otherwise the run reports `build-mismatch`, `dungeon-unknown`, or `knowledge-unavailable`; WHELP does not silently apply stale totals.

## Reload and interruption recovery

Active runs survive `/reload` through SavedVariables. WHELP 0.3.1 also checkpoints the minimal anonymous state needed for an in-flight pull: its start time, death-count baseline, and banked enemy-forces baseline. After `PLAYER_ENTERING_WORLD`, the collector resumes only when the active challenge map and keystone level still match the saved run.

Completed pulls are never erased during recovery. An in-flight pull continues when the player is still in combat; if combat ended while the addon was reloading, it is closed with `endReason: reload-reconciled`. If WHELP reloads into combat without a valid checkpoint, it starts a new partial segment and increments `telemetryGapCount` rather than pretending the missing interval was observed.

When no matching challenge remains active, the saved run is finalized as `abandoned` with `terminationReason: recovery-no-matching-challenge`. Any incomplete pull is discarded and counted as a telemetry gap. Finished observations include `recoveryCount`, `lastRecoveredAt`, and `telemetryGapCount`, allowing downstream comparisons to distinguish uninterrupted evidence from recovered or incomplete telemetry.

## Evidence boundary

Combat-state events are a segmentation heuristic, not proof of route intent. Scenario progress is client-observed evidence, not proof that a SavedVariables file was not edited. Pull observations therefore remain separate from canonical dungeon facts and reviewed strategy, and comparison reports label order matching as inferred.

API behavior was reviewed on 2026-09-02 against Blizzard's generated ScenarioInfo API definitions and the installed Retail 12.1 client/addons. Recheck these assumptions whenever the interface version or secret-value behavior changes.

## Automated runtime test

`npm test` loads the exact addon `.toc` order into a pinned Fengari Lua VM with a minimal mocked WoW API. The lifecycle tests exercise addon initialization, an enabled +10 run, scenario progress, combat boundaries, death penalties, a boss encounter, completion, stale-build fallback, unavailable criteria, reset, collection opt-out, a real namespace reload while a boss pull is active, and stale-run abandonment after a second reload. They also assert that expected identifying fields are absent.

The mock proves WHELP's state transitions and serialized values. It cannot prove that Blizzard fires an event at the expected moment or returns a field unmodified on a live client, so an actual key remains the final integration check after installation.
