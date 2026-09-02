# SavedVariables import

WHELP Collector stores observations locally in `WHELPCollector.lua` under the account's Retail `SavedVariables` directory. On a standard Windows installation it is beneath `_retail_/WTF/Account/<account>/SavedVariables/`. That raw file stays private. The importer creates an allowlisted bundle that can be inspected, compared locally, or submitted to a future ingestion service.

```text
npm run import:savedvariables -- --input <WHELPCollector.lua> [--output <sanitized-bundle.json>]
```

Without `--output`, the bundle is printed to standard output. With `--output`, the importer creates a new file and refuses to overwrite an existing one.

## Security boundary

The importer parses Lua syntax but never executes it. It accepts exactly one assignment to `WHELPCollectorDB` composed only of bounded literal tables, strings, numbers, booleans, and nil. Functions, calls, expressions, extra statements, mixed tables, sparse arrays, duplicate keys, excessive nesting, and oversized input are rejected.

Each observation is rebuilt from an explicit field allowlist. Unknown values are counted and discarded without copying their names or contents into the audit report. Names, chat, tokens, notes, and arbitrary addon fields therefore cannot pass through. Active and incomplete database state is excluded. Privacy flags must explicitly state that names and chat are absent.

Valid observations receive a deterministic SHA-256 hash after sanitization. Duplicate payloads in the same import are emitted once and listed by index. Invalid observations are quarantined by index and a broad reason code; their values are never echoed into the output bundle.

This protects the import process and public output shape. It does not prove that the SavedVariables file describes a real run. Submission-level replay checks, build validation, known-ID checks, independent corroboration, rate limits, and anomaly detection remain responsibilities of the future ingestion service.

## Output

The bundle contract is `schemas/sanitized-observation-bundle.schema.json`. Every exported observation retains its game build, collector version, keystone level, affixes, timing, anonymous class/spec/role snapshots, and optional privacy-safe pull summaries. Raw filesystem paths are not included.
