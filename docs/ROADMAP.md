# Roadmap

## Phase 1 — trustworthy shape

- Stabilize record identifiers and JSON schemas.
- Select one current Mythic+ dungeon as the reference dataset.
- Add canonical dungeon, encounter, NPC, spell, and affix records.
- Add one reviewed route and two spec-note sets. Route extraction and validation foundations are complete; live route curation remains in progress.
- Validate every contribution in CI.

## Phase 2 — local evidence loop

- Complete the WHELP Collector run summary.
- Build a SavedVariables importer and sanitizer.
- Import MDT routes without treating them as verified automatically.
- Parse optional combat logs for deaths, casts, interrupts, dispels, and encounter timing.
- Produce local comparison reports. The first route-to-run report is implemented; aggregation and combat-event comparisons remain.

## Phase 3 — public collaboration

- Choose separate code and data licenses.
- Publish the repository and contribution guide.
- Add pull-request templates and review ownership.
- Publish versioned data releases.
- Build a read-only LLM connector.

## Phase 4 — opt-in aggregation

- Build authenticated ingestion outside GitHub.
- Quarantine and validate submissions.
- Aggregate only sufficiently corroborated observations.
- Add reputation, anomaly detection, retention, and deletion controls.
