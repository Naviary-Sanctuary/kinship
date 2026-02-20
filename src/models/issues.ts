import type { PedigreeId } from './pedigree';

/**
 * Diagnostic severity level.
 *
 * @warn non-blocking data quality signal
 * @error invalid data that should be reported
 * @fatal must stop build pipeline immediately
 */
export type IssueLevel = 'warning' | 'error' | 'fatal';

/**
 * Machine-readable diagnostic codes.
 */
export type IssueCode =
  | 'EMPTY_ID'
  | 'EMPTY_PARENT_ID'
  | 'SELF_PARENT'
  | 'MISSING_PARENT'
  | 'DUPLICATE_ID'
  | 'CYCLE_DETECTED';

export type Field = 'id' | 'sireId' | 'damId';

/**
 * Explainable diagnostic item emitted by validation/build pipeline.
 */
export interface PedigreeIssue {
  level: IssueLevel;
  code: IssueCode;
  message: string;
  id?: PedigreeId;
  field?: Field;
}
