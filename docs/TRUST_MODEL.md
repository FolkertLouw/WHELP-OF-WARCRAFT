# Trust model

WHELP assumes every external submission can be malformed or malicious.

The collector can establish its output schema, collector version, locally observed API values, internal event order, privacy flags, and a deterministic payload hash for duplicate detection.

It cannot prove that SavedVariables were not edited. Open-source addon code cannot safely hold a signing secret. A collector signature proves format or transport identity, not truth.

Submissions progress through four stages:

```text
submitted -> quarantined -> structurally valid -> corroborated -> published aggregate
```

Validation covers schema and build compatibility, known numeric IDs, impossible values, cross-field consistency, duplicates and replay, rate limits, optional combat-log comparison, independent-user corroboration, and outliers.

Canonical facts and curated strategy are never overwritten automatically by observations. Observations may open a review proposal or alter an aggregate confidence score.

When sources disagree, WHELP does not silently select the most convenient value. Prefer, in order: current live-client or official API evidence; current official publisher material; a current content-specific reference; then broader overview or PTR material. Record the disagreement and retrieval dates. A newer dungeon-specific record therefore outranks an older season-wide PTR table for that dungeon's timer, while the older value remains discoverable through provenance rather than becoming an alternate canonical fact.

Historical numerical values must not be promoted into a current-season record merely because the mechanic name is unchanged. If the current source confirms only qualitative behavior, WHELP stores qualitative behavior and leaves the number absent until current evidence exists.

Collection is opt-in. Public observations contain no account names, character names, BattleTags, guilds, chat, or party-member identifiers. Raw SavedVariables and combat logs remain private inputs.
