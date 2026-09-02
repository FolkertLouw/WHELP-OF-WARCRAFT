# WHELP

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
- an LLM grounding brief in `AGENTS.md`;
- a minimal Retail addon, **WHELP Collector**;
- a build manifest for the locally verified Retail build `12.1.0.69587`.

No dungeon strategy has been asserted yet. The examples under `examples/` are synthetic and must never be treated as game facts.

## Quick start

```bash
npm test
```

To test the collector locally, copy `addon/WHELPCollector` into Retail's `Interface/AddOns` directory, restart WoW or run `/reload`, then use `/whelp status`.

## Repository map

```text
addon/        In-game collectors and generated runtime data
data/         Versioned canonical facts
content/      Reviewed mechanics, routes, loadouts, and progression knowledge
observations/ Sanitized fixtures and published aggregate datasets
schemas/      Machine-readable WHELP contracts
tools/        Validation, importing, normalization, and compilation
docs/         Architecture, trust model, and roadmap
examples/     Explicitly synthetic schema examples
```

## Design rule

Every answer must preserve the distinction between **fact**, **strategy**, and **observation**. Every record must identify the game build for which it is valid and retain its provenance.
