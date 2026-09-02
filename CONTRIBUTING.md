# Contributing to WHELP

WHELP accepts canonical facts, curated strategy, schemas, tooling, and sanitized observations.

## Before opening a contribution

1. Run `npm test`.
2. Identify the applicable game build and season.
3. Use numeric game identifiers wherever available.
4. Include provenance and describe how the claim was verified.
5. Put synthetic examples only under `examples/`.
6. Remove all player names, BattleTags, guilds, chat, and other identifying information.
7. Do not submit copied guide prose, proprietary database exports, or content without redistribution rights.

Observations do not become canonical facts merely because they validate. New strategy remains `draft` until reviewed and corroborated.

Raw combat logs and complete SavedVariables files must not be attached to a public pull request.

After changing a current season's dungeon IDs or enemy-forces values, run `npm run generate:addon-knowledge`. The test suite rejects a generated addon lookup that no longer matches canonical JSON.
