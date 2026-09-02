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

Collection is opt-in. Public observations contain no account names, character names, BattleTags, guilds, chat, or party-member identifiers. Raw SavedVariables and combat logs remain private inputs.
