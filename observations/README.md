# Observations

Only sanitized fixtures and published aggregates belong in Git.

Raw SavedVariables, combat logs, names, chat, and other identifying data must remain outside the repository. The `observations/raw/` directory is ignored defensively.

Use `npm run import:savedvariables` to create an allowlisted local bundle. Review its audit counts before sharing it. Sanitization reduces privacy risk but does not establish that a run is authentic; see `docs/SAVEDVARIABLES_IMPORT.md`.
