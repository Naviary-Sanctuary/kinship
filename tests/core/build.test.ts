import { describe, expect, test } from 'bun:test';
import { build } from '../../src/core/build';

describe('build Test', () => {
  describe('valid input', () => {
    test('should build descent indexes and partner indexes', () => {
      const result = build([{ id: 'A', sireId: 'B', damId: 'C' }, { id: 'B' }, { id: 'C' }]);

      if (!result.ok) {
        throw new Error(`Expected build success, but failed with ${result.fatal.code}`);
      }

      expect(result.issues).toEqual([]);
      expect(result.graph.recordsById.get('A')).toEqual({ id: 'A', sireId: 'B', damId: 'C' });
      expect(result.graph.parentsByChildId.get('A')).toEqual(['B', 'C']);
      expect(result.graph.childrenByParentId.get('B')).toEqual(['A']);
      expect(result.graph.childrenByParentId.get('C')).toEqual(['A']);
      expect(result.graph.partnersByIndividualId.get('B')).toEqual(['C']);
      expect(result.graph.partnersByIndividualId.get('C')).toEqual(['B']);
      expect(result.graph.partnerRelationshipsByPairKey.get('B-C')).toEqual({
        pairKey: 'B-C',
        individualAId: 'B',
        individualBId: 'C',
        sharedChildIds: ['A'],
      });
    });

    test('should merge reversed parent order into one partner pair', () => {
      const result = build([
        { id: 'X', sireId: 'C', damId: 'B' },
        { id: 'Y', sireId: 'B', damId: 'C' },
        { id: 'B' },
        { id: 'C' },
      ]);

      if (!result.ok) {
        throw new Error(`Expected build success, but failed with ${result.fatal.code}`);
      }

      expect([...result.graph.partnerRelationshipsByPairKey.keys()]).toEqual(['B-C']);
      expect(result.graph.partnerRelationshipsByPairKey.get('B-C')).toEqual({
        pairKey: 'B-C',
        individualAId: 'B',
        individualBId: 'C',
        sharedChildIds: ['X', 'Y'],
      });
    });
  });

  describe('invalid input', () => {
    test('should keep non-fatal sanitize issues and still build graph', () => {
      const result = build([{ id: 'A', sireId: 'B', damId: 'Z' }, { id: 'A', sireId: 'B' }, { id: 'B' }]);

      if (!result.ok) {
        throw new Error(`Expected build success, but failed with ${result.fatal.code}`);
      }

      expect(result.issues.map((issue) => issue.code)).toEqual(['DUPLICATE_ID', 'MISSING_PARENT']);
      expect(result.graph.parentsByChildId.get('A')).toEqual(['B']);
      expect(result.graph.partnerRelationshipsByPairKey.size).toBe(0);
    });
  });
});
