import type { Nullable } from '../internal/types';
import { isString } from '../internal/util';
import type { Field, PedigreeIssue } from '../models/issues';
import type { PedigreeId, PedigreeRecord, PedigreeRecordInput } from '../models/pedigree';

/**
 * Validation result
 *
 * when id is invalid, record is discarded (null)
 * normalized parent fields use `string | undefined` only (no stored nulls)
 * `issues` order is deterministic: `id -> sireId -> damId`
 */
export interface ValidateRecordResult {
  record: Nullable<PedigreeRecord>;
  issues: readonly PedigreeIssue[];
}

/**
 * Validate a single pedigree record.
 *
 * @param input - Raw input record from external sources (API/JSON/DB).
 * @returns Normalized internal record used after validation and any non-blocking issues.
 */
export function validateRecord(input: PedigreeRecordInput): ValidateRecordResult {
  const issues: PedigreeIssue[] = [];

  const { hasValidId, issues: idIssues } = validateId(input.id);
  issues.push(...idIssues);

  const { hasValidParentId: hasValidSireId, issues: sireIssues } = validateParentId({
    id: hasValidId ? input.id : undefined,
    parentId: input.sireId,
    field: 'sireId',
  });
  issues.push(...sireIssues);

  const { hasValidParentId: hasValidDamId, issues: damIssues } = validateParentId({
    id: hasValidId ? input.id : undefined,
    parentId: input.damId,
    field: 'damId',
  });
  issues.push(...damIssues);

  if (!hasValidId) return { record: null, issues };

  // Inly valid parent ids are included in the normalized output.
  // Invalid or unknown values are omitted from the record
  const record: PedigreeRecord = {
    id: input.id,
    ...(hasValidSireId && isString(input.sireId) ? { sireId: input.sireId } : {}),
    ...(hasValidDamId && isString(input.damId) ? { damId: input.damId } : {}),
  };

  return {
    record,
    issues,
  };
}

/**
 * Validate id
 *
 * validate empty or whitespace-only id
 */
function validateId(id: PedigreeId): { hasValidId: boolean; issues: PedigreeIssue[] } {
  const issues: PedigreeIssue[] = [];

  if (id.trim().length === 0) {
    issues.push({
      level: 'error',
      code: 'EMPTY_ID',
      field: 'id',
      message: `id must not be empty or whitespace-only.`,
    });
  }

  return { hasValidId: issues.length === 0, issues };
}

/**
 * Validate parent id
 *
 * validate empty or whitespace-only parent id
 * validate self-parenting
 */
function validateParentId({
  id,
  parentId,
  field,
}: {
  id?: PedigreeId;
  parentId?: Nullable<PedigreeId>;
  field: Exclude<Field, 'id'>;
}): { hasValidParentId: boolean; issues: PedigreeIssue[] } {
  const issues: PedigreeIssue[] = [];

  // null means "parent unknown"
  if (parentId === null) return { hasValidParentId: true, issues };

  if (parentId?.trim().length === 0) {
    issues.push({
      level: 'error',
      code: 'EMPTY_PARENT_ID',
      field,
      id,
      message: `${field} must not be empty or whitespace-only.`,
    });
  }

  if (id !== undefined && parentId === id) {
    issues.push({
      level: 'error',
      code: 'SELF_PARENT',
      id,
      field,
      message: `${field} must not be the same as individual id.`,
    });
  }

  return { hasValidParentId: issues.length === 0, issues };
}
