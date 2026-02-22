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
    test('should abort build with fatal issue when child-to-parent cycle exists', () => {
      const result = build([
        { id: 'A', sireId: 'B' },
        { id: 'B', sireId: 'A' },
      ]);

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected build failure for cycle input.');
      }

      expect(result.fatal).toEqual({
        level: 'fatal',
        code: 'CYCLE_DETECTED',
        id: 'A',
        message: 'Cycle detected starting at A.',
      });
      expect(result.issues.map((issue) => issue.code)).toEqual(['CYCLE_DETECTED']);
      expect('graph' in result).toBe(false);
    });

    test('should preserve sanitize issues and append cycle fatal issue', () => {
      const result = build([
        { id: 'A', sireId: 'B', damId: 'Z' },
        { id: 'B', sireId: 'A' },
      ]);

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('Expected build failure for cycle input.');
      }

      expect(result.fatal).toEqual({
        level: 'fatal',
        code: 'CYCLE_DETECTED',
        id: 'A',
        message: 'Cycle detected starting at A.',
      });
      expect(result.issues.map((issue) => issue.code)).toEqual(['MISSING_PARENT', 'CYCLE_DETECTED']);
      expect('graph' in result).toBe(false);
    });
  });

  describe('options', () => {
    test('should disable cycle detection when detectCycles is false', () => {
      const result = build(
        [
          { id: 'A', sireId: 'B' },
          { id: 'B', sireId: 'A' },
        ],
        { detectCycles: false },
      );

      expect(result.ok).toBe(true);
      expect(result.issues).toEqual([]);
      expect('graph' in result).toBe(true);
    });
  });
});
