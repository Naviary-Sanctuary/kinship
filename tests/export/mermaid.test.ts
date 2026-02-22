import { describe, expect, test } from 'bun:test';
import { build } from '../../src/core/build';
import { extractFamilyNetwork } from '../../src/query/extract-family-network';
import { toMermaid } from '../../src/export/mermaid';

describe('Mermaid Export Test', () => {
  test('should generate correct mermaid syntax with partners included', () => {
    const result = build([{ id: 'A', sireId: 'B', damId: 'C' }, { id: 'B' }, { id: 'C' }]);

    if (!result.ok) throw new Error('Build failed');

    const network = extractFamilyNetwork(result.graph, 'A');
    const mermaid = toMermaid(network);

    expect(mermaid).toContain('flowchart TD');
    expect(mermaid).toContain('  A["A"]');
    expect(mermaid).toContain('  B["B"]');
    expect(mermaid).toContain('  C["C"]');
    expect(mermaid).toContain('  B --> A');
    expect(mermaid).toContain('  C --> A');
    expect(mermaid).toContain('  B -.- C');
  });

  test('should omit partner links when includePartners is false', () => {
    const result = build([{ id: 'John Doe', sireId: 'Father', damId: 'Mother' }, { id: 'Father' }, { id: 'Mother' }]);

    if (!result.ok) throw new Error('Build failed');

    const network = extractFamilyNetwork(result.graph, 'John Doe');
    const mermaid = toMermaid(network, { includePartners: false });

    expect(mermaid).toContain('  Father --> John_Doe');
    expect(mermaid).toContain('  Mother --> John_Doe');
    expect(mermaid).not.toContain('-.-');
  });

  test('should apply LR orientation', () => {
    const result = build([{ id: 'A' }]);
    if (!result.ok) throw new Error('Build failed');

    const network = extractFamilyNetwork(result.graph, 'A');
    const mermaid = toMermaid(network, { orientation: 'LR' });

    expect(mermaid).toContain('flowchart LR');
  });
});
