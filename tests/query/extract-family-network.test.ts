import { describe, expect, test } from 'bun:test';
import { build } from '../../src/core/build';
import { extractFamilyNetwork } from '../../src/query';

describe('extractFamilyNetwork Test', () => {
  describe('valid input', () => {
    test('should extract lineage and partner links as unified kinship links', () => {
      const result = build([
        { id: 'A', sireId: 'B', damId: 'C' },
        { id: 'B', sireId: 'D', damId: 'E' },
        { id: 'C', sireId: 'F', damId: 'M' },
        { id: 'G', sireId: 'A', damId: 'P' },
        { id: 'R', sireId: 'C', damId: 'Q' },
        { id: 'D' },
        { id: 'E' },
        { id: 'F' },
        { id: 'M' },
        { id: 'P' },
        { id: 'Q' },
      ]);

      if (!result.ok) {
        throw new Error(`Expected build success, but failed with ${result.fatal.code}`);
      }

      const network = extractFamilyNetwork(result.graph, 'A');

      expect(network.focusId).toBe('A');
      expect(network.ancestorIds).toEqual(['B', 'C', 'D', 'E', 'F', 'M']);
      expect(network.descendantIds).toEqual(['G']);
      expect(network.partnerIds).toEqual(['P', 'Q']);
      expect(network.individuals.map((individual) => individual.id)).toEqual([
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
        'M',
        'G',
        'P',
        'Q',
      ]);

      const linkKeys = network.links.map((link) => `${link.kind}:${link.fromId}->${link.toId}`).sort();

      expect(linkKeys).toEqual([
        'DESCENT:A->G',
        'DESCENT:B->A',
        'DESCENT:C->A',
        'DESCENT:D->B',
        'DESCENT:E->B',
        'DESCENT:F->C',
        'DESCENT:M->C',
        'DESCENT:P->G',
        'PARTNER:A->P',
        'PARTNER:B->C',
        'PARTNER:C->Q',
        'PARTNER:D->E',
        'PARTNER:F->M',
      ]);
    });
  });

  describe('invalid input', () => {
    test('should return empty extraction result for unknown focus id', () => {
      const result = build([{ id: 'A' }]);

      if (!result.ok) {
        throw new Error(`Expected build success, but failed with ${result.fatal.code}`);
      }

      expect(extractFamilyNetwork(result.graph, 'UNKNOWN')).toEqual({
        focusId: 'UNKNOWN',
        ancestorIds: [],
        descendantIds: [],
        partnerIds: [],
        individuals: [],
        links: [],
      });
    });
  });
});
