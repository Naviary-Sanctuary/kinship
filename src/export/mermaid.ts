import type { ExtractFamilyNetworkResult } from '../query/types';
import type { MermaidExportOptions } from './types';

/**
 * Converts a given family network into a Mermaid.js flowchart string.
 *
 * WHY this structure:
 * - Nodes and edges are declared separately for cleaner syntax.
 * - Labels are wrapped in double quotes (`id["label"]`) to prevent Mermaid parser
 * errors if the ID contains spaces or special characters.
 * - DESCENT uses solid arrows (`-->`) to show biological direction.
 * - PARTNER uses dotted lines (`-.-`) because they are horizontal, bi-directional
 * relationships without a strict hierarchy.
 */
export function toMermaid(network: ExtractFamilyNetworkResult, options: MermaidExportOptions = {}): string {
  const orientation = options.orientation ?? 'TD';
  const includePartners = options.includePartners ?? true;

  const lines: string[] = [`flowchart ${orientation}`];

  // 1. Declare all nodes (Individuals)
  if (network.individuals.length > 0) {
    lines.push('');
    for (const individual of network.individuals) {
      // Mermaid syntax: NodeID["Label Text"]
      // Node IDs with special chars can sometimes break, but wrapping labels in quotes is safe.
      const safeId = sanitizeMermaidId(individual.id);
      lines.push(`  ${safeId}["${individual.id}"]`);
    }
  }

  // 2. Declare all edges (Links)
  const edgesToRender = includePartners ? network.links : network.links.filter((link) => link.kind === 'DESCENT');

  if (edgesToRender.length > 0) {
    lines.push('');
    for (const link of edgesToRender) {
      const from = sanitizeMermaidId(link.fromId);
      const to = sanitizeMermaidId(link.toId);

      if (link.kind === 'DESCENT') {
        lines.push(`  ${from} --> ${to}`);
      } else if (link.kind === 'PARTNER') {
        lines.push(`  ${from} -.- ${to}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Sanitizes the internal Mermaid node ID to ensure it doesn't break the parser.
 * (Only alphanumeric and underscores are universally safe for node keys).
 */
function sanitizeMermaidId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_');
}
