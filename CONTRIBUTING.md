# Contributing to kinship

Thanks for contributing.

## Ways to contribute

- Report bugs
- Propose features and API ideas
- Improve docs and examples
- Submit code/tests for graph core functionality

## Before you start

- Search existing issues to avoid duplicates.
- For non-trivial changes, open an issue first to discuss scope and design.
- Keep proposals aligned with the pedigree graph core, validation, and the JSON output contract.
- Keep coordinates, visual styling, and renderer-specific exports outside this package.

## Development expectations

- Preserve deterministic output regardless of input order.
- Keep public models separate from internal graph assembly and validation.
- Validation output should be explainable and actionable.
- Do not include real user datasets; use synthetic IDs/data only.
- Keep the package ESM-only and free of runtime dependencies unless a concrete
  requirement justifies changing either constraint.

## Local validation

Use the Bun version declared in `package.json`, install the frozen dependency
graph, and run the complete gate:

```sh
bun install --frozen-lockfile
bun run check
```

Behavior changes require happy-path, boundary, and failure tests. Algorithm
changes that affect traversal, diagnostics, or component assignment should also
include an adversarial or large-input regression test.

## Pull requests

1. Fork and create a focused branch from `main`.
2. Keep each PR scoped to a single concern.
3. Update tests/docs together with behavior changes.
4. Run `bun run check` before opening the PR.
5. Fill out the pull request template completely.

## Commit messages

- Use clear, descriptive commit messages.
- If possible, prefer Conventional Commits style (for example: `feat:`, `fix:`, `docs:`).

## Review and merge

- Maintainers may request design changes before merge.
- Breaking changes should be explicitly called out in the PR.
- Export format changes should be treated carefully because they may affect downstream consumers.

## Security reports

Do not open public issues for unpatched vulnerabilities. Follow
[`SECURITY.md`](./SECURITY.md).

## Maintainer releases

1. Update `CHANGELOG.md` and the package version.
2. Confirm CI succeeds on the release commit.
3. Publish a GitHub Release tagged exactly `v<package version>`.
4. The `release.yml` workflow verifies and publishes through npm trusted
   publishing with provenance.

The npm package must be configured to trust
`Naviary-Sanctuary/kinship` and the `release.yml` workflow before the first
automated release. Long-lived npm publish tokens are not used.

## Code of Conduct

By participating in this project, you agree to follow the Code of Conduct:
[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
