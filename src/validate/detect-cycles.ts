import { EMPTY_PEDIGREE_IDS } from '../internal/constants';
import { generateIssue } from '../models/issue-factory';
import type { KinshipIssue } from '../models/issues';
import type { PedigreeId } from '../models/pedigree';

const NODE_COLORS = ['White', 'Gray', 'Black'] as const;
/**
 * Node colors for the cycle detection algorithm.
 *
 * @White unvisited node
 * @Gray visited node in current path
 * @Black visited node and all its descendants have been processed
 */
type NodeColor = (typeof NODE_COLORS)[number];

/**
 * Detect cycles in a graph using the Depth-First Search (DFS) algorithm with a color marking approach.
 * The algorithm traverses the graph and marks nodes as visited (Gray) when encountered.
 * If a node is encountered again while it is marked as Gray, a cycle is detected.
 * The algorithm returns the first cycle issue encountered or null if no cycles are found.
 */
export function detectCycles(parentsByChildId: ReadonlyMap<PedigreeId, readonly PedigreeId[]>): KinshipIssue | null {
  const colorById = new Map<PedigreeId, NodeColor>();

  const visit = (id: PedigreeId): KinshipIssue | null => {
    const currentColor = colorById.get(id) ?? 'White';

    if (currentColor === 'Gray') {
      return generateIssue('CYCLE_DETECTED', { id });
    }

    if (currentColor === 'Black') {
      return null;
    }

    colorById.set(id, 'Gray');

    const parents = parentsByChildId.get(id) ?? EMPTY_PEDIGREE_IDS;
    let detectedCycle: KinshipIssue | null = null;

    parents.forEach((parentId) => {
      if (detectedCycle) return;
      detectedCycle = visit(parentId);
    });

    if (detectedCycle) {
      return detectedCycle;
    }

    colorById.set(id, 'Black');
    return null;
  };

  let fatalCycleIssue: KinshipIssue | null = null;
  parentsByChildId.forEach((_, childId) => {
    if (fatalCycleIssue || (colorById.get(childId) && colorById.get(childId) !== 'White')) return;
    fatalCycleIssue = visit(childId);
  });

  return fatalCycleIssue;
}
