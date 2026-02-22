import type { KinshipIssue } from './issues';
import type { PedigreeId, PedigreeRecord } from './pedigree';

/**
 * Computed node model used by graph queries.
 * Keeping parent/child adjacency on the node avoids rebuilding indexes per read.
 */
export interface Individual {
  id: PedigreeId;
  parentIds: readonly PedigreeId[];
  childIds: readonly PedigreeId[];
}

/**
 * Edge categories emitted by the engine.
 * Explicit kinds keep traversal logic and render adapters deterministic.
 */
export type RelationshipKind = 'DESCENT' | 'PARTNER';

/**
 * Generic relationship edge for query/extraction output.
 */
export interface KinshipLink {
  kind: RelationshipKind;
  fromId: PedigreeId;
  toId: PedigreeId;
  /**
   * Allows partner links to be explained from concrete offspring evidence.
   */
  viaChildId?: PedigreeId;
}

/**
 * Aggregated partner relation inferred from dual-parent records.
 */
export interface PartnerRelationship {
  /**
   * pairKey is normalized so the same pair has a stable identity regardless of input order.
   */
  pairKey: string;
  individualAId: PedigreeId;
  individualBId: PedigreeId;
  sharedChildIds: readonly PedigreeId[];
}

/**
 * Build options reserved for structural adn domain validation phases.
 */
export interface KinshipBuildOptions {
  detectCycles?: boolean;
  maxBiologicalParents?: number;
}

/**
 * Immutable graph state for functional APIs.
 */
export interface KinshipGraph {
  recordsById: ReadonlyMap<PedigreeId, PedigreeRecord>;
  individualsById: ReadonlyMap<PedigreeId, Individual>;
  parentsByChildId: ReadonlyMap<PedigreeId, readonly PedigreeId[]>;
  childrenByParentId: ReadonlyMap<PedigreeId, readonly PedigreeId[]>;
  partnersByIndividualId: ReadonlyMap<PedigreeId, readonly PedigreeId[]>;
  partnerRelationshipsByPairKey: ReadonlyMap<string, PartnerRelationship>;
  issues: readonly KinshipIssue[];
}

/**
 * Discriminated build result contract.
 * Callers must branch on `ok` before consuming the graph.
 */
export type BuildKinshipGraphResult =
  | {
      ok: true;
      graph: KinshipGraph;
      issues: readonly KinshipIssue[];
    }
  | {
      ok: false;
      fatal: KinshipIssue;
      issues: readonly KinshipIssue[];
    };
