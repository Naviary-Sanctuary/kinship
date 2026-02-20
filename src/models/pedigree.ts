import type { Nullable } from '../internal/types';

/**
 * Stable identifier for an individual in the pedigree graph
 *
 * string only (for now)
 */
export type PedigreeId = string;

/**
 * Raw input record from external sources (API/JSON/DB).
 *
 * sireId/damId allow optional or nullable. because real-world payloads may omit the field or explicitly send null.
 */
export interface PedigreeRecordInput {
  id: PedigreeId;
  sireId?: Nullable<PedigreeId>;
  damId?: Nullable<PedigreeId>;
}

/**
 * Normalized internal record used after validation.
 *
 * Canonical convention:
 * - Unknown parent: field omitted
 * - `null` is allowed in raw input only and should not be persisted internally
 */
export interface PedigreeRecord {
  id: PedigreeId;
  sireId?: PedigreeId;
  damId?: PedigreeId;
}
