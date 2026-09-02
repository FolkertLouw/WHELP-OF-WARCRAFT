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

The current dataset covers all eight Midnight Season 2 Mythic+ dungeons with dungeon IDs, instance maps, teleports, zones, encounters, timers, entrances, enemy-forces values, enemy NPCs, and 149 named interrupt/dispel/enrage ability rows. A generated season ability index groups those rows into 122 unique spell IDs while preserving every dungeon and NPC context plus transparent response tags. Every seasonal dungeon now has a curated response record that separates enemy purges, friendly cleanses, Enrage removal, interrupts, positional counterplay, and recovery actions; the catalog is checked against the season manifest so coverage cannot silently regress. Every dungeon has compact Wowhead-corroborated strategy coverage and spell-linked boss mechanic records. All eight dungeons include machine-readable +10 to +15 PUG route drafts with stable pull IDs, explicit boss checkpoints, and independently recomputed enemy-forces totals. A season route catalog makes required count, planned count, surplus, pull count, boss coverage, mapping warnings, and normalization conflicts directly comparable without hiding source uncertainty. Canonical utility records cover 21 specializations: Restoration and Enhancement Shaman plus every Hunter, Paladin, Druid, Priest, Mage, and Death Knight specialization. Restoration and Enhancement Shaman, all three Death Knight specs, Beast Mastery Hunter, and Marksmanship Hunter have full seasonal utility matrices across all eight dungeons; every matrix cross-links utility axes to modeled class tools and asserted mechanics to canonical spell data. Shaman records distinguish poison, curse, snare, root, fear, charm, and sleep removal, including action-level talent availability. Hunter matrices distinguish target drops, self-cleanses, movement removal, enemy dispels, control, and immunity usage without treating personal tools as party coverage. Composition queries cover Bloodlust equivalents, combat resurrection, external defensive, enemy repositioning, party damage reduction, persistent group buffs, and per-action or configuration requirements. The season affix set is machine-readable across keystone thresholds. Canonical IDs are versioned and sourced; uncorroborated discoveries remain drafts. The examples under `examples/` are synthetic and must never be treated as game facts.

WHELP does not mirror third-party guides. It stores compact original records, stable identifiers, validity ranges, retrieval timestamps, and links back to the source so updates can be reviewed.

Source maintenance is machine-readable. `npm run query:freshness` compares every canonical provenance-bearing record with the current build and the checked-in freshness policy. It reports source age separately from build validity and returns an actionable review queue; use `--as-of <ISO-date> --include all` for a reproducible full audit. See `docs/FRESHNESS.md`.

## Quick start

```bash
npm test
```

Query a specialization against the curated dungeon-response catalog:

```bash
npm run query:spec-responses -- --spec enhancement-shaman --dungeon ruby-life-pools --priority critical
```

The result identifies exact class tools, talent requirements, unsupported actions, and self-only defensives without treating them as party coverage.

Build a compact dungeon loadout or inspect the gaps between multiple specializations:

```bash
npm run query:loadout -- --spec restoration-shaman --dungeon murder-row
npm run query:party-gaps -- --specs restoration-shaman,enhancement-shaman,beast-mastery-hunter --dungeon murder-row
```

The party report covers shared utility only. Universal positioning and personal defensives are returned separately and never counted as group coverage.

Query class and composition capabilities independently of a dungeon:

```bash
npm run query:capabilities -- --specs holy-paladin,protection-paladin --action battle-resurrection
npm run query:capabilities -- --specs holy-paladin,retribution-paladin --action cleanse-magic
npm run query:capabilities -- --specs restoration-shaman,beast-mastery-hunter,marksmanship-hunter --action bloodlust
npm run query:capabilities -- --specs balance-druid,restoration-druid --action group-buff
```

Priest records distinguish healer `Purify` from Shadow's Disease-only dispel, represent `Mass Dispel` as mixed friendly/enemy area utility, and expose `Power Infusion` as an external offensive cooldown:

```powershell
npm run query:capabilities -- --specs discipline-priest,holy-priest,shadow-priest --action external-offensive
npm run query:capabilities -- --specs discipline-priest,holy-priest,shadow-priest --scope mixed-area
```

Mage records expose shared Counterspell, Time Warp, Arcane Intellect, Remove Curse, Spellsteal, and Polymorph utility while preserving each specialization's defensive barrier:

```powershell
npm run query:capabilities -- --specs arcane-mage,fire-mage,frost-mage --action bloodlust
npm run query:capabilities -- --specs arcane-mage,fire-mage,frost-mage --action cleanse-curse
```

Death Knight records keep true interrupts, enemy displacement, combat resurrection, and magic-only party mitigation separate:

```powershell
npm run query:capabilities -- --specs blood-death-knight,frost-death-knight,unholy-death-knight --action battle-resurrection
npm run query:capabilities -- --specs blood-death-knight,frost-death-knight,unholy-death-knight --action enemy-reposition
```

Query the joined seasonal matrix for exact dungeon tools, ratings, mechanic spell IDs, affix advice, and provenance:

```powershell
npm run query:spec-matrix -- --spec blood-death-knight --dungeon ruby-life-pools
npm run query:spec-matrix -- --spec frost-death-knight --dungeon kings-rest --rating always
npm run query:matrix-coverage
```

Capability results preserve action-specific availability, alternate faction spell IDs, and configuration requirements, so a talent-gated extension or pet-dependent group tool remains visible.

The capability catalog is intentionally marked partial in `data/specs/coverage.json`. Query output includes that completeness state and the number of modeled specs; an absent spec means “not modeled yet,” never “has no utility.”

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
