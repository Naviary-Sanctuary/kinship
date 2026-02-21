import { describe, expect, test } from 'bun:test';
import { sanitizeRecords } from '../../src/validate/sanitize-records';

describe('sanitizeRecords Test', () => {
  describe('valid input', () => {
    test.each([
      [[{ id: 'A', sireId: 'B' }, { id: 'B' }], { records: [{ id: 'A', sireId: 'B' }, { id: 'B' }], issues: [] }],
      [
        [
          { id: 'A', sireId: 'B', damId: 'C' },
          { id: 'B', sireId: 'D', damId: 'E' },
          { id: 'C', sireId: 'F', damId: 'G' },
          { id: 'D' },
          { id: 'E' },
          { id: 'F' },
          { id: 'G' },
        ],
        {
          records: [
            { id: 'A', sireId: 'B', damId: 'C' },
            { id: 'B', sireId: 'D', damId: 'E' },
            { id: 'C', sireId: 'F', damId: 'G' },
            { id: 'D' },
            { id: 'E' },
            { id: 'F' },
            { id: 'G' },
          ],
          issues: [],
        },
      ],
    ])('should return a sanitized record and no issues for input: $input', (input, expected) => {
      const result = sanitizeRecords(input);
      expect(result).toStrictEqual(expected);
    });
  });

  describe('invalid input', () => {
    describe('DUPLICATE_ID', () => {
      test('should return a sanitized record and issues for duplicate id', () => {
        const result = sanitizeRecords([
          { id: 'A', sireId: 'B', damId: null },
          { id: 'A', sireId: 'B', damId: null },
          { id: 'B' },
        ]);
        expect(result.records).toEqual([{ id: 'A', sireId: 'B' }, { id: 'B' }]);
        expect(result.issues).toEqual([
          { level: 'error', code: 'DUPLICATE_ID', id: 'A', message: 'Duplicate id found: A.' },
        ]);
      });
    });

    describe('MISSING_PARENT', () => {
      test('should drop parent links that reference missing ids', () => {
        const result = sanitizeRecords([{ id: 'A', sireId: 'B', damId: 'C' }, { id: 'B' }]);

        expect(result.records).toEqual([{ id: 'A', sireId: 'B' }, { id: 'B' }]);
        expect(result.issues).toEqual([
          {
            level: 'error',
            code: 'MISSING_PARENT',
            field: 'damId',
            id: 'A',
            message: 'damId is missing.',
          },
        ]);
      });
    });
  });
});
