# Mythic Dungeon Tools import

`tools/import-mdt.mjs` extracts factual identifiers from a Mythic Dungeon Tools dungeon module into a normalized JSON representation.

```bash
npm run import:mdt -- --input "/path/to/Dungeon.lua" --output "/temporary/path/extract.json"
```

The parser currently extracts:

- dungeon index and English name;
- challenge map and teleport spell IDs;
- zone IDs and total enemy forces;
- enemy names, NPC IDs, and forces;
- spell IDs and MDT's interrupt, dispel, and enrage flags.

The generated extraction is not committed automatically. A maintainer reviews it, records the exact MDT version and applicable game build, resolves names from permissible sources, and promotes selected facts into WHELP records.

MDT is GPL-2.0. WHELP does not copy its Lua implementation, artwork, map coordinates, or route data through this importer. The public records contain normalized factual identifiers with explicit attribution. Any future route importer must undergo a separate licensing review before its output is published.
