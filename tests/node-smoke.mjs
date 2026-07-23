import assert from 'node:assert/strict';
import { Kinship } from '@naviary-sanctuary/kinship';

const result = new Kinship([
  { id: 'father', gender: 'male' },
  { id: 'mother', gender: 'female' },
  { id: 'child', fatherId: 'father', motherId: 'mother' },
]).build();

assert.equal(result.ok, true);
assert.equal(result.graph.schemaVersion, 1);
assert.equal(result.graph.nodes.length, 4);
assert.equal(result.graph.edges.length, 3);
assert.equal(result.graph.components.length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(result)), result);

{
  const depth = 40_000;
  const deepResult = new Kinship(
    Array.from({ length: depth }, (_, index) => ({
      id: `bird-${index.toString().padStart(5, '0')}`,
      ...(index > 0
        ? {
            fatherId: `bird-${(index - 1).toString().padStart(5, '0')}`,
          }
        : {}),
    })),
  ).build();

  assert.equal(deepResult.ok, true);
  if (!deepResult.ok) throw new Error('Expected a deep pedigree graph.');
  assert.equal(deepResult.graph.nodes.length, depth * 2 - 1);
  assert.equal(
    deepResult.graph.nodes.find(
      (node) => node.kind === 'individual' && node.individualId === `bird-${(depth - 1).toString().padStart(5, '0')}`,
    )?.lineageDepth,
    depth - 1,
  );
}

{
  const childCount = 130_000;
  const wideResult = new Kinship([
    { id: 'wide-father' },
    { id: 'wide-mother' },
    ...Array.from({ length: childCount }, (_, index) => ({
      id: `wide-child-${index.toString().padStart(6, '0')}`,
      fatherId: 'wide-father',
      motherId: 'wide-mother',
    })),
  ]).build();

  assert.equal(wideResult.ok, true);
  if (!wideResult.ok) throw new Error('Expected a wide pedigree graph.');
  assert.equal(wideResult.graph.nodes.length, childCount + 3);
  assert.equal(wideResult.graph.edges.length, childCount + 2);
  assert.equal(wideResult.graph.components.length, 1);
}
