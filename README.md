# kinship

Deterministic pedigree graph engine for TypeScript.

`kinship` turns raw pedigree records into a validated, queryable kinship graph for data-driven breeding workflows.

## Install

```sh
npm install @naviary-sanctuary/kinship
```

Also available with other package managers:

```sh
pnpm add @naviary-sanctuary/kinship
yarn add @naviary-sanctuary/kinship
bun add @naviary-sanctuary/kinship
```

## Core Architecture: The Separated Partner Model

Genealogical DAGs often break when horizontal mating (partner) relationships create cycles. `kinship` prevents this by maintaining two strict internal topologies:

1. **Descent Graph**: A pure, strict parent-to-child DAG for lightning-fast biological lineage traversal and exact generation depth tracking.
2. **Partner Map**: An auxiliary bidirectional map for mating relationships.

These topologies remain mathematically isolated during processing and are only unified into `KinshipLink` arrays during subgraph extraction (`extractFamilyNetwork`).

## Quick Start

```ts
import { build, getAncestors, getDescendants, extractFamilyNetwork } from '@naviary-sanctuary/kinship';

const records = [
  { id: 'A', sireId: 'B', damId: 'C' },
  { id: 'B', sireId: 'D', damId: 'E' },
  { id: 'C' },
  { id: 'D' },
  { id: 'E' },
];

const result = build(records);

if (!result.ok) {
  console.error(result.fatal.code, result.fatal.message);
  process.exit(1);
}

const ancestorsOfA = [...getAncestors(result.graph, 'A')];
const descendantsOfB = [...getDescendants(result.graph, 'B')];
const familyOfA = extractFamilyNetwork(result.graph, 'A');

console.log({
  ancestorsOfA,
  descendantsOfB,
  familyOfA,
  issues: result.issues, // non-fatal diagnostics
});
```

## Data Model

```ts
type PedigreeId = string;

interface PedigreeRecordInput {
  id: PedigreeId;
  sireId?: PedigreeId | null;
  damId?: PedigreeId | null;
}
```

Normalization rules:

- `id` is trimmed and must be non-empty.
- `sireId` / `damId` allow `null` or `undefined` for unknown parent.
- Blank parent IDs are invalid.
- Invalid or missing parent links are removed from normalized records and reported as issues.

## Diagnostics

The build pipeline returns explainable diagnostics with `level`, `code`, `message`, and optional `id`/`field`.

| Code              | Level   | Meaning                                      |
| ----------------- | ------- | -------------------------------------------- |
| `EMPTY_ID`        | `error` | Individual ID is empty                       |
| `EMPTY_PARENT_ID` | `error` | Parent ID is empty                           |
| `SELF_PARENT`     | `error` | Parent ID equals child ID                    |
| `SAME_PARENT`     | `error` | `sireId` and `damId` are identical           |
| `MISSING_PARENT`  | `error` | Parent reference does not exist in input set |
| `DUPLICATE_ID`    | `error` | Duplicate ID exists (first record is kept)   |
| `CYCLE_DETECTED`  | `fatal` | Cycle detected in child-to-parent graph      |

If a `fatal` issue exists, `build` returns `{ ok: false, fatal, issues }`.

## Development

```sh
bun install
bun run typecheck
bun run lint
bun run fmt
bun test
```

## Community

- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [AI Policy](./AI_POLICY.md)
