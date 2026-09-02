# Source audits

WHELP separates source attribution from claim verification. A specialization matrix can be complete and useful while its editorial sources are still awaiting a claim-by-claim audit.

The generated catalog at `data/source-audits/coverage.json` makes that boundary queryable for every current Retail specialization.

## Coverage levels

- `fully-audited`: every declared guide source is covered by an audit explicitly marked complete.
- `partially-audited`: at least one source has claim-level audit evidence, but the full declared source set has not been completely audited.
- `provenance-only`: the matrix links to one or more sources, but WHELP has no claim-level audit for them yet.
- `no-source`: the matrix has no usable source URL. This is a data-quality failure, not an assertion that the specialization has no guidance.

Coverage is not a quality score for a class or guide. It describes WHELP's verification work only.

## Claim dispositions

Audits preserve the source claim and assign a review disposition:

- `accepted`: independently compatible with WHELP's canonical facts or matrix.
- `rejected-cross-dungeon`: evidence belongs to a different dungeon than the source section claims.
- `rejected-placeholder`: source material is a template token or implementation artifact rather than player guidance.
- `unresolved`: insufficient evidence to accept or reject safely.

Accepted mechanic claims must join to the correct dungeon and spell in the generated ability index. Accepted utility ratings must equal the matching matrix cell. Accepted utility mentions must map to a modeled, non-`none` axis. These checks run in the repository test suite.

## Commands

Inspect the portfolio or a single specialization:

```bash
npm run query:source-audit-coverage
npm run query:source-audit-coverage -- --level provenance-only
npm run query:source-audit-coverage -- --spec restoration-shaman
```

Inspect individual claims:

```bash
npm run query:source-claims -- --spec restoration-shaman
npm run query:source-claims -- --disposition unresolved
```

Regenerate the catalog after adding or changing matrices and audits:

```bash
npm run generate:source-audit-coverage
npm test
```

The test suite regenerates the catalog in memory and compares it with the checked-in file, so stale coverage cannot pass CI.

## Promotion rules

An audit may set `coverageCompleteness` to `complete` only when its declared source URL has been examined across the relevant guide scope, all extracted in-scope claims are represented, and the audit explains known exclusions. A specialization becomes fully audited only when every source URL declared by its current matrix is covered by such a complete audit.

Do not promote a source merely because sampled claims were accurate. Partial audits remain partial until their scope is demonstrably exhaustive.
