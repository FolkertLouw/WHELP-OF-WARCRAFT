# Architecture

WHELP has four independent layers:

1. **Collection** records privacy-safe observations inside the game client.
2. **Ingestion** imports exports and combat logs outside the game.
3. **Knowledge** stores versioned facts and reviewed strategy.
4. **Delivery** produces Git releases, addon data packs, APIs, and LLM connectors.

The addon is not the database server and GitHub is not the raw telemetry ingestion service.

Canonical facts come from official APIs or redistributable game data and are immutable within a build snapshot. Curated strategy contains reviewed interpretations with declared applicability and provenance. Observations describe actual runs; individual submissions are evidence, not truth.

An LLM connector should resolve the current build, retrieve a small relevant record set, and return record IDs, validity, provenance, and confidence. It must not inject the entire repository into every prompt.

A knowledge compiler will eventually turn verified records into compact Lua tables under `addon/WHELPCollector/GeneratedKnowledge`. Generated files must identify their dataset revision and build range.

Route plans and run observations meet through stable route and pull identifiers. The route remains curated knowledge; an observed pull is evidence of what happened. Importers may compare the two, but telemetry cannot mutate a route or promote it from draft without review. See `docs/ROUTES.md` for the route invariants and MDT import boundary.

Raw SavedVariables cross from collection into ingestion through a non-executing literal parser and an explicit privacy allowlist. Sanitized bundles carry deterministic payload hashes for local duplicate detection, but no signature or hash can prove an edited local file is truthful. See `docs/SAVEDVARIABLES_IMPORT.md`.

The collector's build-specific numeric lookup is generated from canonical JSON rather than maintained as a second hand-edited database. Patch 12 pull telemetry is limited to banked weighted scenario progress and combat-state boundaries; secret unit identities are neither read nor reconstructed. See `docs/COLLECTOR.md`.
