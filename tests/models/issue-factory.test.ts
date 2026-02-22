import { describe, expect, test } from 'bun:test';
import { generateIssue } from '../../src/models/issue-factory';
import type { IssueCode, KinshipIssue } from '../../src/models/issues';

type TestEntry = [label: string, act: () => KinshipIssue, expected: Partial<KinshipIssue>];

const cases: Record<IssueCode, TestEntry[]> = {
  EMPTY_ID: [
    [
      'EMPTY_ID',
      () => generateIssue('EMPTY_ID'),
      { level: 'error', code: 'EMPTY_ID', message: 'id must not be empty or whitespace-only.' },
    ],
  ],
  EMPTY_PARENT_ID: [
    [
      'EMPTY_PARENT_ID',
      () => generateIssue('EMPTY_PARENT_ID', { field: 'sireId', id: 'A' }),
      {
        level: 'error',
        code: 'EMPTY_PARENT_ID',
        id: 'A',
        field: 'sireId',
        message: 'sireId must not be empty or whitespace-only.',
      },
    ],
  ],
  SELF_PARENT: [
    [
      'SELF_PARENT',
      () => generateIssue('SELF_PARENT', { field: 'sireId', id: 'A' }),
      {
        level: 'error',
        code: 'SELF_PARENT',
        id: 'A',
        field: 'sireId',
        message: 'sireId must not be the same as individual id.',
      },
    ],
  ],
  SAME_PARENT: [
    [
      'SAME_PARENT',
      () => generateIssue('SAME_PARENT', { id: 'A' }),
      { level: 'error', code: 'SAME_PARENT', id: 'A', message: 'Sire and Dam must not be same.' },
    ],
  ],
  MISSING_PARENT: [
    [
      'MISSING_PARENT',
      () => generateIssue('MISSING_PARENT', { field: 'sireId', id: 'A' }),
      { level: 'error', code: 'MISSING_PARENT', id: 'A', field: 'sireId', message: 'sireId is missing.' },
    ],
  ],
  DUPLICATE_ID: [
    [
      'DUPLICATE_ID (deduplicate)',
      () => generateIssue('DUPLICATE_ID', { id: 'A', option: { deduplicate: true } }),
      { level: 'warning', code: 'DUPLICATE_ID', id: 'A', message: 'Duplicate id found: A.' },
    ],
    [
      'DUPLICATE_ID (no deduplicate)',
      () => generateIssue('DUPLICATE_ID', { id: 'A', option: { deduplicate: false } }),
      { level: 'error', code: 'DUPLICATE_ID', id: 'A', message: 'Duplicate id found: A.' },
    ],
  ],
  CYCLE_DETECTED: [
    [
      'CYCLE_DETECTED',
      () => generateIssue('CYCLE_DETECTED', { id: 'A', cyclePath: ['A', 'B', 'C'] }),
      { level: 'fatal', code: 'CYCLE_DETECTED', id: 'A', message: 'Cycle detected starting at A. Path: A -> B -> C.' },
    ],
  ],
};

const allCases: TestEntry[] = Object.values(cases).flat();

describe('issueFactory Test', () => {
  describe('generateIssue Test', () => {
    test.each(allCases)('%s', (_label, act, expected) => {
      expect(act()).toEqual(expected as KinshipIssue);
    });
  });
});
