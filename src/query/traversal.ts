import { EMPTY_PEDIGREE_IDS } from '../internal/constants';
import type { KinshipGraph } from '../models/kinship';
import type { PedigreeId } from '../models/pedigree';
import type { TraversalVisit, TraversalOptions } from './types';

function normalizeMaxDepth(max?: number): number {
  if (max === undefined) return Number.POSITIVE_INFINITY;
  if (!Number.isFinite(max)) return max > 0 ? Number.POSITIVE_INFINITY : 0;

  const normalized = Math.trunc(max);
  return normalized < 0 ? 0 : normalized;
}

/**
 * BFS over vertical edges with a strict depth limit.
 * The depth guard is required so callers can safely query local neighborhoods
 * without paying full-graph traversal cost.
 */
function bfsTraverse(
  startId: PedigreeId,
  getNextIds: (id: PedigreeId) => readonly PedigreeId[],
  maxDepth?: number,
): TraversalVisit[] {
  const depthLimit = normalizeMaxDepth(maxDepth);
  if (depthLimit === 0) return [];

  const visited = new Set<PedigreeId>();
  const queue: Array<[PedigreeId, number]> = getNextIds(startId).map((nextId) => [nextId, 1]);
  const visits: TraversalVisit[] = [];

  let cursor = 0;
  while (cursor < queue.length) {
    const [currentId, depth] = queue[cursor];
    cursor += 1;

    if (depth > depthLimit || visited.has(currentId)) continue;

    visited.add(currentId);
    visits.push({ id: currentId, depth });

    if (depth >= depthLimit) continue;

    getNextIds(currentId).forEach((nextId) => {
      if (!visited.has(nextId)) {
        queue.push([nextId, depth + 1]);
      }
    });
  }

  return visits;
}

export function getAncestors(
  graph: KinshipGraph,
  id: PedigreeId,
  options?: TraversalOptions & { includeDepth?: false },
): ReadonlySet<PedigreeId>;
export function getAncestors(
  graph: KinshipGraph,
  id: PedigreeId,
  options: TraversalOptions & { includeDepth: true },
): readonly TraversalVisit[];
export function getAncestors(
  graph: KinshipGraph,
  id: PedigreeId,
  options: TraversalOptions = {},
): ReadonlySet<PedigreeId> | readonly TraversalVisit[] {
  const visits = bfsTraverse(
    id,
    (currentId) => graph.parentsByChildId.get(currentId) ?? EMPTY_PEDIGREE_IDS,
    options.maxDepth,
  );

  if (options.includeDepth === true) return visits;

  return visits.reduce<Set<PedigreeId>>((set, visit) => {
    set.add(visit.id);
    return set;
  }, new Set<PedigreeId>());
}

export function getDescendants(
  graph: KinshipGraph,
  id: PedigreeId,
  options?: TraversalOptions & { includeDepth?: false },
): ReadonlySet<PedigreeId>;
export function getDescendants(
  graph: KinshipGraph,
  id: PedigreeId,
  options: TraversalOptions & { includeDepth: true },
): readonly TraversalVisit[];
export function getDescendants(
  graph: KinshipGraph,
  id: PedigreeId,
  options: TraversalOptions = {},
): ReadonlySet<PedigreeId> | readonly TraversalVisit[] {
  const visits = bfsTraverse(
    id,
    (currentId) => graph.childrenByParentId.get(currentId) ?? EMPTY_PEDIGREE_IDS,
    options.maxDepth,
  );
  if (options.includeDepth === true) return visits;

  return visits.reduce<Set<PedigreeId>>((set, visit) => {
    set.add(visit.id);
    return set;
  }, new Set<PedigreeId>());
}
