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

## Evidence boundary

Combat-state events are a segmentation heuristic, not proof of route intent. Scenario progress is client-observed evidence, not proof that a SavedVariables file was not edited. Pull observations therefore remain separate from canonical dungeon facts and reviewed strategy, and comparison reports label order matching as inferred.

API behavior was reviewed on 2026-09-02 against Blizzard's generated ScenarioInfo API definitions and the installed Retail 12.1 client/addons. Recheck these assumptions whenever the interface version or secret-value behavior changes.

## Automated runtime test

`npm test` loads the exact addon `.toc` order into a pinned Fengari Lua VM with a minimal mocked WoW API. The lifecycle test exercises addon initialization, an enabled +10 run, scenario progress, combat boundaries, death penalties, a boss encounter, completion, stale-build fallback, unavailable criteria, reset, and collection opt-out. It also asserts that expected identifying fields are absent.

The mock proves WHELP's state transitions and serialized values. It cannot prove that Blizzard fires an event at the expected moment or returns a field unmodified on a live client, so an actual key remains the final integration check after installation.
