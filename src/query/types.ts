import type { Individual, KinshipLink } from '../models/kinship';
import type { PedigreeId } from '../models/pedigree';

/**
 * A visit record is needed when traversal output must preserve generation distance
 * instead of only reporting membership.
 */
export interface TraversalVisit {
  id: PedigreeId;
  /**
   * Depth is required to keep generation-aware consumers deterministic.
   * Without explicit depth, renderers and analyzers would need to recompute BFS layers
   */
  depth: number;
}

/**
 * Traversal options provide bounded expansion and output-shape control
 * so the same BFS core can serve both lightweight and generation-aware queries.
 */
export interface TraversalOptions {
  /**
   * A depth cap is needed to prevent unbounded expansion on large pedigrees
   * when callers only need a local neighborhood around the root.
   */
  maxDepth?: number;
  /**
   * Optional depth payload avoids forcing every caller to pay serialization cost
   * when they only need membership checks from a Set-like result.
   */
  includeDepth?: boolean;
}

export interface ExtractFamilyNetworkResult {
  focusId: PedigreeId;
  ancestorIds: readonly PedigreeId[];
  descendantIds: readonly PedigreeId[];
  partnerIds: readonly PedigreeId[];
  individuals: readonly Individual[];
  links: readonly KinshipLink[];
}
