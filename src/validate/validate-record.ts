import type { Nullable } from '../internal/types';
import { isString } from '../internal/util';
import type { Field, PedigreeIssue } from '../models/issues';
import type { PedigreeId, PedigreeRecord, PedigreeRecordInput } from '../models/pedigree';

/**
 * Validation result
 *
 * when id is invalid, record is discarded (null)
 * normalized parent fields use `string | undefined` only (no stored nulls)
 * `issues` order is deterministic: `id -> sireId -> damId -> cross-field`
 */
export interface ValidateRecordResult {
  record: Nullable<PedigreeRecord>;
  issues: readonly PedigreeIssue[];
}

interface OptionalIdNormalization {
  normalizedParentId?: PedigreeId;
  isMissing: boolean;
  isBlank: boolean;
}

/**
 * Validate a single pedigree record.
 *
 * @param input - Raw input record from external sources (API/JSON/DB).
 * @returns Normalized internal record used after validation and any non-blocking issues.
 */
export function validateRecord(input: PedigreeRecordInput): ValidateRecordResult {
  const issues: PedigreeIssue[] = [];

  const trimmedId = input.id.trim();

  const { hasValidId, issues: idIssues } = validateId(trimmedId);
  issues.push(...idIssues);

  const issueId = hasValidId ? trimmedId : undefined;

  const {
    hasValidParentId: hasValidSireId,
    normalizeParentId: normalizedSireId,
    issues: sireIssues,
  } = validateParentId({
    id: issueId,
    parentId: input.sireId,
    field: 'sireId',
  });
  issues.push(...sireIssues);

  const {
    hasValidParentId: hasValidDamId,
    normalizeParentId: normalizedDamId,
    issues: damIssues,
  } = validateParentId({
    id: issueId,
    parentId: input.damId,
    field: 'damId',
  });
  issues.push(...damIssues);

  const hasSameParent =
    hasValidSireId &&
    hasValidDamId &&
    normalizedSireId !== undefined &&
    normalizedDamId !== undefined &&
    normalizedSireId === normalizedDamId;

  if (hasSameParent) {
    issues.push({
      level: 'error',
      code: 'SAME_PARENT',
      id: issueId,
      message: 'Sire and Dam must not be same.',
    });
  }

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

function normalizeParentId(id?: Nullable<PedigreeId>): OptionalIdNormalization {
  if (id === null || id === undefined) {
    return { normalizedParentId: undefined, isMissing: true, isBlank: false };
  }

  const trimmedId = id.trim();
  if (trimmedId.length === 0) {
    return { normalizedParentId: undefined, isMissing: false, isBlank: true };
  }

  return { normalizedParentId: trimmedId, isMissing: false, isBlank: false };
}

/**
 * Validate id
 *
 * id must be non-empty after normalization
 */
function validateId(id: PedigreeId): { hasValidId: boolean; issues: PedigreeIssue[] } {
  const issues: PedigreeIssue[] = [];

  if (id.length === 0) {
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
}): { hasValidParentId: boolean; normalizeParentId?: PedigreeId; issues: PedigreeIssue[] } {
  const issues: PedigreeIssue[] = [];
  const normalized = normalizeParentId(parentId);

  // null means "parent unknown"
  if (normalized.isMissing) {
    return { hasValidParentId: true, normalizeParentId: undefined, issues };
  }

  if (normalized.isBlank) {
    issues.push({
      level: 'error',
      code: 'EMPTY_PARENT_ID',
      field,
      id,
      message: `${field} must not be empty or whitespace-only.`,
    });
  }

  if (id !== undefined && normalized.normalizedParentId !== undefined && normalized.normalizedParentId === id) {
    issues.push({
      level: 'error',
      code: 'SELF_PARENT',
      id,
      field,
      message: `${field} must not be the same as individual id.`,
    });
  }

  return { hasValidParentId: issues.length === 0, normalizeParentId: normalized.normalizedParentId, issues };
}
