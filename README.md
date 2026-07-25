# kinship

Deterministic, renderer-neutral pedigree topology engine for Naviary.

`kinship` accepts the structural fields already present on backend `Parrot`
entities and optional `Pair` entities. It returns a deterministic,
JSON-serializable graph that can be sent to the frontend without converting
`Map` objects or reconstructing couples and sibling groups.

This package projects supplied parentage into graph topology. It does not verify
DNA parentage, calculate kinship or inbreeding coefficients, or provide
clinical, genetic, or breeding decisions. See
[`INTEROPERABILITY.md`](./INTEROPERABILITY.md) before integrating standards or
scientific workflows.

## Why a family node exists

The reference pedigrees connect children from the center of a couple, not from
two unrelated parent-to-child lines. `kinship` represents that semantic
junction as a first-class `family` node:

```text
individual ──▶ family ◀── individual
                  │
                  ├──▶ child
                  └──▶ child
```

A graph renderer can hide the family node and draw the familiar horizontal
couple line. Coordinates, card sizes, colors, spacing, and edge routing remain
renderer responsibilities.

## Install

> [!IMPORTANT]
> This README documents the unreleased `0.2.0` API on `main`. npm's
> `latest` tag still resolves to legacy `0.1.1`, which is incompatible with
> the examples below. Do not use the unversioned install command for this API
> until `0.2.0` is published.

After `0.2.0` is published:

```sh
bun add @naviary-sanctuary/kinship
```

```sh
npm install @naviary-sanctuary/kinship
```

Run the package on Node.js 20 or newer or Bun 1.2 or newer. The published
package is ESM-only; use `import` rather than `require()`.

## Usage

Existing backend entities can be passed directly because the input contract is
structural:

```ts
import { Kinship } from '@naviary-sanctuary/kinship';

const result = new Kinship({
  parrots,
  pairs,
}).build();

if (!result.ok) {
  // Translate this structured result to the service's validation error contract.
  return { data: null, issues: result.issues };
}

return {
  data: {
    graph: result.graph,
    individuals: parrots.map(({ id, name, morph, gender, primaryPhotoId }) => ({
      id,
      name,
      morph,
      gender,
      primaryPhotoId,
    })),
    pairs: pairs.map(({ id, maleId, femaleId, pairedAt }) => ({
      id,
      maleId,
      femaleId,
      pairedAt,
    })),
  },
  issues: result.issues,
};
```

When explicit Pair data is not needed, a Parrot array is enough:

```ts
const result = new Kinship(parrots).build();
```

Only topology fields are returned. ORM entities are never copied into the
graph, so private events, audit fields, notes, files, and other internal data
cannot leak through this package. The API layer joins an explicit public DTO by
`individualId` and `pairIds`, as shown above.

## Input contract

```ts
interface KinshipParrotInput {
  id: string;
  fatherId?: string | null;
  motherId?: string | null;
  gender?: 'male' | 'female' | 'unknown';
}

interface KinshipPairInput {
  id: string;
  maleId: string;
  femaleId: string;
}
```

Additional fields such as name, morph, photos, hatch date, status, or pairing
date may exist on the input entity, but the engine deliberately ignores them.

`gender` keeps the existing Naviary field name. Here it is only the recorded
male/female/unknown reproductive-sex marker used to validate father/mother and
Pair roles. It is not a general gender-identity, karyotype, or taxonomy field.

### Source-of-truth rules

- `fatherId` and `motherId` are the only sources of biological parentage.
- Optional `Pair` records add partner relationships and preserve Pair history.
- A Pair never creates a parent-child relationship.
- `Parrot.pairId` is intentionally ignored. It describes a current backlink,
  can become stale after breakup, and is not the Pair that produced that
  Parrot.
- Several Pair records with the same endpoints are retained on one visual
  family through their IDs.
- A Pair matching an inferred father/mother combination upgrades the family
  origin from `parentage` to `both`.

## Output contract

Successful builds return:

```ts
interface KinshipGraph {
  readonly schemaVersion: 1;
  readonly nodes: readonly (KinshipIndividualNode | KinshipFamilyNode)[];
  readonly edges: readonly (KinshipPartnerEdge | KinshipChildEdge)[];
  readonly components: readonly KinshipComponent[];
}
```

### Individual nodes

- Have one canonical node per individual ID.
- Use `resolution: 'resolved'` when a Parrot was supplied.
- Use `resolution: 'unresolved'` when another record references an ID absent
  from the input.
- Include normalized gender and `lineageDepth`, defined as the longest known
  biological-parent path from a founder. It is not a renderer rank.

### Family nodes

- Group siblings that have the same two known parents.
- Keep one-known-parent children in separate families so the engine does not
  invent a shared unknown parent.
- Represent childless explicit Pairs.
- Include Pair IDs, origin, missing parent roles, and `lineageDepth`, defined as
  the highest individual lineage depth among the known partners. It is not a
  renderer rank or coordinate.

Partner and child relationships live only in typed edges. `partner` edges carry
the male/female role; `child` edges connect the family junction to each child.
This is the canonical relationship source, so node metadata cannot drift from
duplicated relationship arrays.

### Components

Disconnected pedigrees are returned as separate components instead of being
attached to an artificial super-root. Each component includes its member node
IDs, biological root node IDs, and lineage-depth range.

### IDs

Node and edge IDs are deterministic, collision-safe strings. Treat them as
opaque values; their current encoding is not a public parsing contract. They
are graph-local identifiers, not durable registry IDs. Persist and join the
source `individualId` and `pairIds` instead.

## Validation policy

The engine returns `{ ok: false, issues }` and no misleading partial graph for:

- malformed or whitespace-padded IDs;
- sparse Parrot or Pair collections;
- invalid runtime `gender` enum values;
- duplicate Parrot or Pair IDs;
- self-parent and self-pair relationships;
- the same individual used as both parents;
- conflicting father/mother roles anywhere in the input;
- contradictory male/female roles anywhere in Pair history;
- Pair roles that contradict authoritative parentage in another family;
- biological parentage cycles.

The following conditions preserve the graph and return warnings:

- referenced Parrot data is absent;
- recorded gender conflicts with a father/mother role;
- Pair endpoints conflict with recorded gender;
- Pair male/female roles are reversed relative to authoritative parentage.

Unknown parent references become reference nodes instead of being discarded.
Cycle detection is always enabled because lineage depth cannot be truthfully
calculated for a cyclic pedigree. Each cyclic strongly connected component
returns one deterministic witness path, preventing overlapping cycles from
creating quadratic diagnostics.

### Issue codes

| Code                               | Severity         | Meaning                                                |
| ---------------------------------- | ---------------- | ------------------------------------------------------ |
| `INVALID_INPUT`                    | error            | Top-level shape or collection type is invalid.         |
| `INVALID_PARROT`                   | error            | A Parrot entry is missing or is not an object.         |
| `INVALID_INDIVIDUAL_ID`            | error            | A Parrot ID is missing, empty, or padded.              |
| `INVALID_GENDER`                   | error            | A supplied gender enum is unsupported.                 |
| `DUPLICATE_INDIVIDUAL_ID`          | error            | More than one Parrot uses an ID.                       |
| `INVALID_PARENT_ID`                | error            | A parent ID is empty, non-string, or padded.           |
| `SELF_PARENT` / `SAME_PARENT`      | error            | Parentage is self-referential or ambiguous.            |
| `PARENT_ROLE_CONFLICT`             | error            | An individual is declared in both parent roles.        |
| `PARENTAGE_CYCLE`                  | error            | A biological-parent cycle exists.                      |
| `INVALID_PAIR` / `INVALID_PAIR_ID` | error            | A Pair entry is missing, or it or its ID is invalid.   |
| `DUPLICATE_PAIR_ID`                | error            | More than one Pair uses an ID.                         |
| `INVALID_PAIR_ENDPOINT_ID`         | error            | A Pair endpoint ID is invalid.                         |
| `SELF_PAIR`                        | error            | A Pair connects an individual to itself.               |
| `PAIR_ROLE_CONFLICT`               | warning or error | Pair roles contradict parentage or other Pair records. |
| `UNRESOLVED_INDIVIDUAL`            | warning          | A referenced individual was not supplied.              |
| `PARENT_GENDER_CONFLICT`           | warning          | Recorded gender contradicts a parent role.             |
| `PAIR_GENDER_CONFLICT`             | warning          | Recorded gender contradicts a Pair role.               |

Issue arrays are deterministic for a given input. `inputIndex` refers to the
caller's original array, so reordering invalid input intentionally changes that
location metadata.

## Production boundary

`build()` is synchronous and in-memory. Normal UUID-sized records scale close
to linearly, and the regression suite covers a 40,000-generation chain,
130,000 siblings, and adversarial overlapping cycles. The complete output is
also linear in graph size and can itself be large.

At an API or import boundary:

- validate body size, record counts, and identifier length before construction;
- run very large imports in a worker or background job instead of a
  latency-sensitive request handler;
- do not log complete issue arrays when identifiers are sensitive;
- scope or paginate data before sending very large graphs to a browser; and
- pass plain records or normal domain entities. Proxies and throwing getters
  are outside the supported input boundary.

The constructor retains the input reference and reads it on each `build()`.
Treat an instance as a short-lived build command; do not mutate its source while
reusing it.

## Renderer boundary

`kinship` produces semantic topology and biological lineage-depth hints. The
companion
[`@naviary-sanctuary/kinship-graph`](https://github.com/Naviary-Sanctuary/kinship-graph)
consumes this topology and owns:

- x/y placement and partner alignment;
- node occurrence duplication for a strict focus-centered ancestor chart;
- line routing through hidden family junctions;
- birth-date or domain-specific sibling ordering, zoom, selection, and visual
  styling.

Keeping canonical individuals in this package avoids duplicating domain
identity. If a renderer needs the same ancestor in multiple visual positions,
its view projection can create multiple occurrences that reference the same
`individualId`.

## Contract versioning

`schemaVersion: 1` covers only the graph topology contract. Changing node or
edge kinds, removing or renaming fields, changing their meaning, or changing
the opaque ID identity rules requires schema version 2. Adding optional
metadata or new issue codes does not.

Version `0.2.0` replaces the `0.1.x` functional `build`/query/Mermaid API. The
renderer-specific Mermaid export was removed intentionally; migrate to
`new Kinship(input).build()` and consume the returned nodes and edges.

Package versions remain pre-1.0. Breaking TypeScript API changes use a minor
version, while breaking graph wire-contract changes also increment
`schemaVersion`.

## Security and support

Security fixes target the latest `0.x` line. Report vulnerabilities privately
as described in [`SECURITY.md`](./SECURITY.md). General bugs and feature
requests use the GitHub issue forms. Changes are recorded in
[`CHANGELOG.md`](./CHANGELOG.md).

## Development

```sh
bun install --frozen-lockfile
bun run check
```

The gate checks formatting, lint, strict types, Bun tests, an ESM build, and
Node.js consumption. The package has no runtime dependencies.

## Contributing

See the
[contribution guide](https://github.com/Naviary-Sanctuary/kinship/blob/main/CONTRIBUTING.md)
and
[code of conduct](https://github.com/Naviary-Sanctuary/kinship/blob/main/CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE)
