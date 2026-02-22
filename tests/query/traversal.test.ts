import { describe, expect, test } from 'bun:test';
import { build } from '../../src/core/build';
import { getAncestors, getDescendants } from '../../src/query';

describe('traversal Test', () => {
  describe('valid input', () => {
    test('should return unique ancestors in BFS order', () => {
      const result = build([
        { id: 'A', sireId: 'B', damId: 'C' },
        { id: 'B', sireId: 'D', damId: 'E' },
        { id: 'C', sireId: 'F', damId: 'M' },
        { id: 'D' },
        { id: 'E' },
        { id: 'F' },
        { id: 'M' },
      ]);

      if (!result.ok) {
        throw new Error(`Expected build success, but failed with ${result.fatal.code}`);
      }

      expect([...getAncestors(result.graph, 'A')]).toEqual(['B', 'C', 'D', 'E', 'F', 'M']);
    });

    test('should return descendants in BFS order with deduplication', () => {
      const result = build([
        { id: 'A' },
        { id: 'B', sireId: 'A' },
        { id: 'C', sireId: 'A' },
        { id: 'D', sireId: 'B', damId: 'C' },
      ]);

      if (!result.ok) {
        throw new Error(`Expected build success, but failed with ${result.fatal.code}`);
      }

      expect([...getDescendants(result.graph, 'A')]).toEqual(['B', 'C', 'D']);
    });

    test('should return depth payload when includeDepth is true', () => {
      const result = build([
        { id: 'A', sireId: 'B', damId: 'C' },
        { id: 'B', sireId: 'D', damId: 'E' },
        { id: 'C', sireId: 'F', damId: 'M' },
        { id: 'D' },
        { id: 'E' },
        { id: 'F' },
        { id: 'M' },
      ]);

      if (!result.ok) {
        throw new Error(`Expected build success, but failed with ${result.fatal.code}`);
      }

      expect(getAncestors(result.graph, 'A', { includeDepth: true })).toEqual([
        { id: 'B', depth: 1 },
        { id: 'C', depth: 1 },
        { id: 'D', depth: 2 },
        { id: 'E', depth: 2 },
        { id: 'F', depth: 2 },
        { id: 'M', depth: 2 },
      ]);
    });
  });

  describe('options', () => {
    test('should apply maxDepth boundary', () => {
      const result = build([
        { id: 'A', sireId: 'B', damId: 'C' },
        { id: 'B', sireId: 'D', damId: 'E' },
        { id: 'C', sireId: 'F', damId: 'M' },
        { id: 'D' },
        { id: 'E' },
        { id: 'F' },
        { id: 'M' },
      ]);

      if (!result.ok) {
        throw new Error(`Expected build success, but failed with ${result.fatal.code}`);
      }

      expect([...getAncestors(result.graph, 'A', { maxDepth: 1 })]).toEqual(['B', 'C']);
      expect([...getAncestors(result.graph, 'A', { maxDepth: 0 })]).toEqual([]);
      expect([...getAncestors(result.graph, 'A', { maxDepth: -1 })]).toEqual([]);
    });
  });

  describe('invalid input', () => {
    test('should return empty results for unknown id', () => {
      const result = build([{ id: 'A' }]);

      if (!result.ok) {
        throw new Error(`Expected build success, but failed with ${result.fatal.code}`);
      }

      expect([...getAncestors(result.graph, 'UNKNOWN')]).toEqual([]);
      expect([...getDescendants(result.graph, 'UNKNOWN')]).toEqual([]);
    });
  });
});
