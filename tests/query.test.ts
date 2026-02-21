import { describe, expect, test } from 'bun:test';
import { build } from '../src/core/build';
import {
  getChildIds,
  getIndividual,
  getIssues,
  getParentIds,
  getPartnerIds,
  getPartnerRelationships,
  hasIndividual,
} from '../src/query';

describe('query Test', () => {
  test('should return expected query values for known ids', () => {
    const result = build([{ id: 'A', sireId: 'B', damId: 'C' }, { id: 'B' }, { id: 'C' }]);

    if (!result.ok) {
      throw new Error(`Expected build success, but failed with ${result.fatal.code}`);
    }

    const { graph } = result;

    expect(hasIndividual(graph, 'A')).toBe(true);
    expect(getIndividual(graph, 'A')).toEqual({
      id: 'A',
      parentIds: ['B', 'C'],
      childIds: [],
    });
    expect(getParentIds(graph, 'A')).toEqual(['B', 'C']);
    expect(getChildIds(graph, 'B')).toEqual(['A']);
    expect(getPartnerIds(graph, 'B')).toEqual(['C']);
    expect(getPartnerRelationships(graph, 'B')).toEqual([
      {
        pairKey: 'B-C',
        individualAId: 'B',
        individualBId: 'C',
        sharedChildIds: ['A'],
      },
    ]);
  });

  test('should return empty defaults for unknown ids', () => {
    const result = build([{ id: 'A' }]);

    if (!result.ok) {
      throw new Error(`Expected build success, but failed with ${result.fatal.code}`);
    }

    const { graph } = result;

    expect(hasIndividual(graph, 'UNKNOWN')).toBe(false);
    expect(getIndividual(graph, 'UNKNOWN')).toBeUndefined();
    expect(getParentIds(graph, 'UNKNOWN')).toEqual([]);
    expect(getChildIds(graph, 'UNKNOWN')).toEqual([]);
    expect(getPartnerIds(graph, 'UNKNOWN')).toEqual([]);
    expect(getPartnerRelationships(graph, 'UNKNOWN')).toEqual([]);
  });

  test('should expose accumulated graph issues', () => {
    const result = build([{ id: 'A', sireId: 'B', damId: 'Z' }, { id: 'A', sireId: 'B' }, { id: 'B' }]);

    if (!result.ok) {
      throw new Error(`Expected build success, but failed with ${result.fatal.code}`);
    }

    expect(getIssues(result.graph).map((issue) => issue.code)).toEqual(['DUPLICATE_ID', 'MISSING_PARENT']);
  });
});
