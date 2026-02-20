import { describe, expect, test } from 'bun:test';
import { validateRecord } from '../../src/validate/validate-record';
import { PedigreeIssue } from '../../src/models/issues';

describe('validateRecord Test', () => {
  describe('valid input', () => {
    test.each([
      [
        { id: 'A', sireId: 'B', damId: null },
        { record: { id: 'A', sireId: 'B' }, issues: [] },
      ],
      [
        { id: 'A', sireId: null, damId: 'C' },
        { record: { id: 'A', damId: 'C' }, issues: [] },
      ],
      [
        { id: 'A', sireId: 'B', damId: undefined },
        { record: { id: 'A', sireId: 'B' }, issues: [] },
      ],
      [
        { id: 'A', sireId: undefined, damId: 'C' },
        { record: { id: 'A', damId: 'C' }, issues: [] },
      ],
      [
        { id: 'A', sireId: 'B' },
        { record: { id: 'A', sireId: 'B' }, issues: [] },
      ],
      [
        { id: 'A', damId: 'B' },
        { record: { id: 'A', damId: 'B' }, issues: [] },
      ],
      [
        { id: 'A', sireId: 'B', damId: 'C' },
        { record: { id: 'A', sireId: 'B', damId: 'C' }, issues: [] },
      ],
    ])('should return a normalized record and no issues for input: $id, $sireId, $damId', (input, expected) => {
      const result = validateRecord(input);
      expect(result).toStrictEqual(expected);
    });
  });

  describe('invalid input', () => {
    describe('EMPTY_ID', () => {
      test('should return null record and issues for empty id', () => {
        const result = validateRecord({ id: '', sireId: 'B', damId: null });
        expect(result.record).toBeNull();
        expect(result.issues).toEqual([
          { level: 'error', code: 'EMPTY_ID', field: 'id', message: 'id must not be empty or whitespace-only.' },
        ]);
      });
    });

    describe('EMPTY_PARENT_ID', () => {
      test.each([
        [
          { id: 'A', sireId: '' },
          {
            record: { id: 'A' },
            issues: [
              {
                level: 'error',
                code: 'EMPTY_PARENT_ID',
                field: 'sireId',
                id: 'A',
                message: 'sireId must not be empty or whitespace-only.',
              },
            ] as PedigreeIssue[],
          },
        ],
        [
          { id: 'A', damId: '' },
          {
            record: { id: 'A' },
            issues: [
              {
                level: 'error',
                code: 'EMPTY_PARENT_ID',
                field: 'damId',
                id: 'A',
                message: 'damId must not be empty or whitespace-only.',
              },
            ] as PedigreeIssue[],
          },
        ],
      ])('should return record and issues for input: $id, $sireId, $damId', (input, expected) => {
        const result = validateRecord(input);

        expect(result).toStrictEqual(expected);
      });
    });

    describe('SELF_PARENT', () => {
      test.each([
        [
          { id: 'A', sireId: 'A' },
          {
            record: { id: 'A' },
            issues: [
              {
                level: 'error',
                code: 'SELF_PARENT',
                field: 'sireId',
                id: 'A',
                message: 'sireId must not be the same as individual id.',
              },
            ] as PedigreeIssue[],
          },
        ],
        [
          { id: 'A', damId: 'A' },
          {
            record: { id: 'A' },
            issues: [
              {
                level: 'error',
                code: 'SELF_PARENT',
                field: 'damId',
                id: 'A',
                message: 'damId must not be the same as individual id.',
              },
            ] as PedigreeIssue[],
          },
        ],
      ])('should return record and issues for input: $id, $sireId, $damId', (input, expected) => {
        const result = validateRecord(input);
        expect(result).toStrictEqual(expected);
      });
    });
  });
});
