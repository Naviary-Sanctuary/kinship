# Changelog

All notable changes are documented here. This project follows Semantic
Versioning, with the usual pre-1.0 allowance for breaking changes in minor
versions.

## [Unreleased]

## [0.2.0] - 2026-07-24

### Added

- `Kinship` class API for direct Parrot arrays or `{ parrots, pairs }` input.
- Renderer-neutral individual, family-junction, partner-edge, child-edge, and
  disconnected-component output.
- Structured, JSON-safe validation issues and unresolved reference nodes.
- Deterministic opaque graph IDs and lineage-depth hints.
- Node.js package smoke testing, CI matrices, trusted-publishing workflow, and
  security/interoperability documentation.
- Packed-artifact type checks for both NodeNext and bundler module resolution.
- Static GitHub Actions workflow validation in CI.

### Changed

- Biological parent fields are authoritative; Pair records only supplement
  partner history.
- Parentage cycle reporting now returns one deterministic witness per cyclic
  strongly connected component.
- Reproductive father/mother and male/female roles are enforced across the
  complete input, not only inside one family.
- Component assignment uses an integer-index disjoint-set representation to
  avoid per-node adjacency sets.
- Builds use the TypeScript compiler directly and publish ESM plus declaration
  and source-map files.

### Security

- Invalid runtime gender values now fail validation instead of silently
  becoming `unknown`.
- Overlapping cycle diagnostics no longer exhibit quadratic memory growth.
- Issue sort keys are serialized once instead of once per comparison.
- Clean-source package creation always builds `dist` through `prepack`.
- Sparse arrays fail with one bounded diagnostic and caller-supplied collection
  iterators or reducers are never executed during validation.
- Releases reject mismatched SemVer prerelease metadata and revalidate the
  installable packed artifact before publishing.
- Prereleases publish under the npm `next` tag instead of replacing `latest`.

### Removed

- The `0.1.x` functional build/query API and renderer-specific Mermaid export.

## [0.1.1] - Legacy

Last published release of the original functional pedigree toolkit.
