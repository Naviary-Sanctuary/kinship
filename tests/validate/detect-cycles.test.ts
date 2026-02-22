import { describe, expect, test } from 'bun:test';
import { detectCycles } from '../../src/validate/detect-cycles';

describe('detectCycles Test', () => {
  test('should return null for an acyclic child-to-parent graph', () => {
    const adjacency = new Map([
      ['A', ['B', 'C']],
      ['B', ['D']],
      ['C', ['E']],
      ['D', []],
      ['E', []],
    ]);

    const result = detectCycles(adjacency);

    expect(result).toBeNull();
  });

  test('should report fatal cycle issue for a self cycle', () => {
    const adjacency = new Map([['A', ['A']]]);

    const result = detectCycles(adjacency);

    expect(result).toEqual({
      level: 'fatal',
      code: 'CYCLE_DETECTED',
      id: 'A',
      message: 'Cycle detected starting at A. Path: A -> A.',
    });
  });

  test('should report fatal cycle issue for a multi-node cycle', () => {
    const adjacency = new Map([
      ['A', ['B']],
      ['B', ['C']],
      ['C', ['A']],
    ]);

    const result = detectCycles(adjacency);

    expect(result).toEqual({
      level: 'fatal',
      code: 'CYCLE_DETECTED',
      id: 'A',
      message: 'Cycle detected starting at A. Path: A -> B -> C -> A.',
    });
  });

  test('should detect a cycle even when only one disconnected component is cyclic', () => {
    const adjacency = new Map([
      ['A', ['B']],
      ['B', []],
      ['X', ['Y']],
      ['Y', ['X']],
    ]);

    const result = detectCycles(adjacency);

    expect(result).toEqual({
      level: 'fatal',
      code: 'CYCLE_DETECTED',
      id: 'X',
      message: 'Cycle detected starting at X. Path: X -> Y -> X.',
    });
  });
});
