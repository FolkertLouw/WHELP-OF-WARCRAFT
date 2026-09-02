# WHELP-OF-WARCRAFT

**World-data Hub for Encounters, Loadouts & Progression**

WHELP is an open, versioned World of Warcraft knowledge base designed for players, addons, tools, and language models.

WHELP keeps three kinds of information deliberately separate:

1. **Canonical facts** — identifiers and game facts tied to a specific client build.
2. **Curated strategy** — reviewed mechanics, routes, loadouts, and progression advice.
3. **Observed evidence** — privacy-safe summaries of what happened in actual play.

The repository is the reviewable public knowledge layer. Raw high-volume telemetry belongs in an ingestion system; only validated fixtures, releases, and aggregates belong in Git.

## Current status

Version 1.0 is a validated, queryable foundation. It includes:

- the WHELP data and trust model;
- JSON schemas and synthetic examples;
- a dependency-free repository validator;
- route extraction safeguards and planned-versus-observed pull contracts;
- an LLM grounding brief in `AGENTS.md`;
- a minimal Retail addon, **WHELP Collector**;
- a build manifest for the locally verified Retail build `12.1.0.69587`.

The current dataset covers all eight Midnight Season 2 Mythic+ dungeons with dungeon IDs, instance maps, teleports, zones, encounters, timers, entrances, enemy-forces values, enemy NPCs, and 149 named interrupt/dispel/enrage ability rows. A generated season ability index groups those rows into 122 unique spell IDs while preserving every dungeon and NPC context plus transparent response tags. Every dungeon has curated response records, compact Wowhead-corroborated strategy, spell-linked boss mechanics, and a machine-readable +10 to +15 PUG route draft.

Canonical utility records and complete eight-dungeon matrices cover 33 specializations: Restoration and Enhancement Shaman plus every Hunter, Paladin, Druid, Priest, Mage, Death Knight, Warrior, Rogue, Warlock, and Monk specialization. Composition queries preserve scope, action-level talent availability, configuration requirements, and distinctions between interrupts, stops, dispels, self-cleanses, group buffs, temporary health, damage reduction, movement tools, and consumable supply. The season affix set is machine-readable across keystone thresholds. Canonical IDs are versioned and sourced; uncorroborated discoveries remain drafts. The examples under `examples/` are synthetic and must never be treated as game facts.

WHELP does not mirror third-party guides. It stores compact original records, stable identifiers, validity ranges, retrieval timestamps, and links back to the source so updates can be reviewed.

All three Mage specializations now also have complete Midnight Season 2 utility matrices. Their records keep target cancellation, personal snare or root removal, ally Curse removal, enemy Magic theft, and crowd control as distinct queryable concepts.

All three Paladin specializations now have complete seasonal utility matrices as well. Holy preserves its healer-only Magic dispel alongside talent-dependent Poison and Disease removal; Protection and Retribution retain the narrower Cleanse Toxins boundary. Blessings, control, interrupts, and battle resurrection remain separately queryable instead of being collapsed into generic utility.

Discipline Priest now has a complete seasonal matrix covering single and area Magic removal, offensive purges, self-only snare removal, route-oriented detection reduction, talent-dependent Disease cleansing, and creature-type-limited Shackle Horror control. Matrix query results retain tool scope and requirements so downstream agents do not mistake personal utility for party coverage.

All three Priest specializations now have complete seasonal matrices. Holy retains the healer Purify model; Shadow instead has Disease-only single-target removal plus Mass Dispel, Silence, Dominate Mind, and Dispersion. Creature restrictions are encoded as negative coverage, preventing Mind Soothe or Dominate Mind from being recommended against ineligible Undead or Aberration targets.

All four Druid specializations now have complete seasonal matrices, bringing the modeled catalog to 21 of 21 full matrices. The records distinguish Restoration's harmful-Magic dispel from non-healer Curse and Poison removal, keep shapeshifting as self-only root or snare removal, and classify Typhoon and Ursol's Vortex as positional stops rather than spell-school interrupts. Guide omissions remain explicit: the current Guardian and Restoration sources provide generic utility but little or no dungeon-specific advice, so WHELP labels canonical mechanic joins instead of attributing invented tips to those authors.

All three Warrior specializations extend the catalog to 24 full seasonal matrices. WHELP represents Rallying Cry as a temporary party-health increase rather than damage reduction, Spell Reflection as a self-only and mechanic-dependent response, and Bitter Immunity as self-only Curse, Disease, and Poison removal. Protection's Disrupting Shout is a true area spell-school interrupt with a taunt side effect; Shockwave and other stuns remain crowd-control stops.

All three Rogue specializations extend the catalog to 27 full matrices. Route-dependent Shroud stealth, delayed Tricks threat transfer, configured utility poisons, Shiv Enrage removal, single-target stops, self-only Cloak cleansing, and Vanish target cancellation are distinct query concepts. WHELP does not promote Vanish into a general dispel or treat Shroud as invisibility.

All three Warlock specializations extend the catalog to 30 full matrices. Healthstone supply, Soulstone combat resurrection, Gateway movement, curses, pet-dependent friendly cleansing, pet- or talent-dependent purging, and configured interrupts remain separate concepts. Current spell evidence overrides ambiguous guide shorthand: Grimoire: Fel Ravager is modeled as a purge and Axe Toss as a stun/current-cast stop, not as guaranteed spell-school lockout coverage.

All three Monk specializations extend the catalog to 33 full matrices. Brewmaster and Windwalker retain Poison/Disease-only Detox records, while Mistweaver separately models its harmful-Magic Detox and Improved Detox expansion. Tiger's Lust is typed as single-target external movement plus root/snare removal; Diffuse Magic and Swift Art remain self-only; Ring of Peace is displacement rather than a spell-school interrupt; and Mistweaver's missing Spear Hand Strike remains explicit.

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
