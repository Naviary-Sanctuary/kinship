import type { KinshipIssue } from './issues';
import type { PedigreeId, PedigreeRecord } from './pedigree';

/**
 * Immutable graph indexes produced by build
 */
export interface PedigreeGraph {
  /**
   * Primary index for O(1) individual lookup by id
   */
  recordsById: ReadonlyMap<PedigreeId, PedigreeRecord>;

  /**
   * Reverse index (parent -> children ids) used by descendant/path queries.
   */
  childrenByParentId: ReadonlyMap<PedigreeId, readonly PedigreeId[]>;
}

/**
 * Build-time options for graph construction
 */
export interface BuildOptions {
  /**
   * Enable cycle detection in parent links.
   * @default true
   */
  detectCycles?: boolean;
}

/**
 * Result of build operation
 *
 * Contract:
 * - ok=true -> graph is available
 * - ok=false -> fatal issue is available, graph is not produced
 *
 * NOTE:
 * - Non-fatal diagnostics are always returned via issues array.
 */
export type BuildPedigreeResult =
  | {
      ok: true;
      graph: PedigreeGraph;
      issues: readonly KinshipIssue[];
    }
  | {
      ok: false;
      fatal: KinshipIssue;
      issues: readonly KinshipIssue[];
    };
