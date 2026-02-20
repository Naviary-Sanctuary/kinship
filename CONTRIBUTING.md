# Contributing to kinship

Thanks for contributing.
This project is currently in a bootstrap phase, so contributions may include both documentation and initial code scaffolding.

## Ways to contribute

- Report bugs
- Propose features and API ideas
- Improve docs and examples
- Submit code/tests for graph core functionality

## Before you start

- Search existing issues to avoid duplicates.
- For non-trivial changes, open an issue first to discuss scope and design.
- Keep proposals aligned with project scope: pedigree graph core, validation, query, and export helpers.

## Development expectations

- Prefer deterministic behavior and pure functions in core logic.
- Keep concerns separated: model, indexing, query, and validation.
- Validation output should be explainable and actionable.
- Do not include real user datasets; use synthetic IDs/data only.

## Pull requests

1. Fork and create a focused branch from `main`.
2. Keep each PR scoped to a single concern.
3. Update tests/docs together with behavior changes.
4. If scripts/tooling exist in your revision, run the relevant local checks before opening the PR.
5. Fill out the pull request template completely.

## Commit messages

- Use clear, descriptive commit messages.
- If possible, prefer Conventional Commits style (for example: `feat:`, `fix:`, `docs:`).

## Review and merge

- Maintainers may request design changes before merge.
- Breaking changes should be explicitly called out in the PR.
- Export format changes should be treated carefully because they may affect downstream consumers.

## Code of Conduct

By participating in this project, you agree to follow the Code of Conduct:
[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
