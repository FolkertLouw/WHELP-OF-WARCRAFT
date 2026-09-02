# WHELP-OF-WARCRAFT

**World-data Hub for Encounters, Loadouts & Progression**

WHELP is an open, versioned World of Warcraft knowledge base designed for players, addons, tools, and language models.

WHELP keeps three kinds of information deliberately separate:

1. **Canonical facts** — identifiers and game facts tied to a specific client build.
2. **Curated strategy** — reviewed mechanics, routes, loadouts, and progression advice.
3. **Observed evidence** — privacy-safe summaries of what happened in actual play.

The repository is the reviewable public knowledge layer. Raw high-volume telemetry belongs in an ingestion system; only validated fixtures, releases, and aggregates belong in Git.

## Current status

This is the initial foundation. It includes:

- the WHELP data and trust model;
- JSON schemas and synthetic examples;
- a dependency-free repository validator;
- route extraction safeguards and planned-versus-observed pull contracts;
- an LLM grounding brief in `AGENTS.md`;
- a minimal Retail addon, **WHELP Collector**;
- a build manifest for the locally verified Retail build `12.1.0.69587`.

The current dataset covers all eight Midnight Season 2 Mythic+ dungeons with dungeon IDs, instance maps, teleports, zones, encounters, timers, entrances, enemy-forces values, enemy NPCs, and flagged interrupt/dispel/enrage abilities. Every dungeon has a compact Wowhead-corroborated strategy overview and spell-linked boss mechanic records. King's Rest and Ruby Life Pools include machine-readable +10 to +15 PUG route drafts with stable pull IDs, explicit boss checkpoints, and recomputed enemy-forces totals. Full Restoration and Enhancement Shaman utility matrices compare relevant dispels, control, movement tools, and rotating-affix responses across all eight dungeons. The season affix set is machine-readable across keystone thresholds. Canonical IDs are versioned and sourced; uncorroborated discoveries remain drafts. The examples under `examples/` are synthetic and must never be treated as game facts.

WHELP does not mirror third-party guides. It stores compact original records, stable identifiers, validity ranges, retrieval timestamps, and links back to the source so updates can be reviewed.

## Quick start

```bash
npm test
```

To test the collector locally, copy `addon/WHELPCollector` into Retail's `Interface/AddOns` directory, restart WoW or run `/reload`, then use `/whelp status`.

To inspect a locally installed Mythic Dungeon Tools module without copying its implementation into WHELP:

```bash
npm run import:mdt -- --input "/path/to/MythicDungeonTools/Expansion/Dungeon.lua"
```

The importer emits normalized dungeon, enemy, enemy-forces, and spell-flag facts. Imported output is evidence requiring review; it does not become verified strategy automatically.

To inspect MDT spawn groups before curating a route:

```bash
npm run inspect:mdt-packs -- "/path/to/MythicDungeonTools/Expansion/Dungeon.lua"
```

Spawn groups are review evidence, not a route. The inspector intentionally exposes count mismatches caused by summoned or encounter-only entities; see `docs/ROUTES.md`.

To compare a sanitized run observation with its planned route:

```text
npm run compare:route -- --route <route.json> --observation <run-observation.json>
```

The JSON report keeps exact pull-ID matches separate from order-based inference and exposes count drift, missing or extra pulls, deaths, durations, and boss checkpoints. See `docs/ROUTES.md` for its trust boundary.

To sanitize local WHELP Collector SavedVariables without executing Lua:

```text
npm run import:savedvariables -- --input <WHELPCollector.lua> [--output <sanitized-bundle.json>]
```

The importer strips unknown fields, excludes active state, quarantines malformed runs, and hashes sanitized observations for duplicate detection. Raw SavedVariables stay private; see `docs/SAVEDVARIABLES_IMPORT.md`.

The addon now compiles build-stamped dungeon totals from canonical JSON and records Patch 12-safe pull segments using banked scenario progress. Active runs and anonymous pull checkpoints survive `/reload`; recovered and incomplete telemetry is labeled explicitly. It does not collect secret enemy identities or use the protected combat log. See `docs/COLLECTOR.md`.

The test suite executes a complete collector lifecycle in a mocked Lua/WoW runtime, in the exact file order declared by the addon manifest. Live-client event timing still requires an in-game integration run.

To regenerate the seven season-wide dungeon packages described by the checked-in import manifest:

```bash
npm run import:season-mdt -- --mdt-root "/path/to/MythicDungeonTools/Midnight"
```

## Repository map

```text
addon/        In-game collectors and generated runtime data
data/         Versioned canonical facts
content/      Reviewed mechanics, routes, loadouts, and progression knowledge
observations/ Sanitized fixtures and published aggregate datasets
schemas/      Machine-readable WHELP contracts
tools/        Validation, importing, normalization, and compilation
docs/         Architecture, trust model, route rules, and roadmap
examples/     Explicitly synthetic schema examples
```

## Design rule

Every answer must preserve the distinction between **fact**, **strategy**, and **observation**. Every record must identify the game build for which it is valid and retain its provenance.
