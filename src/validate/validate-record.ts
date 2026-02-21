import type { Nullable } from '../internal/types';
import { generateIssue } from '../models/issue-factory';
import type { Field, KinshipIssue } from '../models/issues';
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
  issues: readonly KinshipIssue[];
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
  const issues: KinshipIssue[] = [];

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
    issues.push(generateIssue('SAME_PARENT', { id: issueId }));
  }

  if (!hasValidId) return { record: null, issues };

  // Inly valid parent ids are included in the normalized output.
  // Invalid or unknown values are omitted from the record
  const record: PedigreeRecord = {
    id: trimmedId,
    ...(!hasSameParent && hasValidSireId && normalizedSireId !== undefined ? { sireId: normalizedSireId } : {}),
    ...(!hasSameParent && hasValidDamId && normalizedDamId !== undefined ? { damId: normalizedDamId } : {}),
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
function validateId(id: PedigreeId): { hasValidId: boolean; issues: KinshipIssue[] } {
  const issues: KinshipIssue[] = [];

  if (id.length === 0) {
    issues.push(generateIssue('EMPTY_ID'));
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
}): { hasValidParentId: boolean; normalizeParentId?: PedigreeId; issues: KinshipIssue[] } {
  const issues: KinshipIssue[] = [];
  const normalized = normalizeParentId(parentId);

  // null means "parent unknown"
  if (normalized.isMissing) {
    return { hasValidParentId: true, normalizeParentId: undefined, issues };
  }

  if (normalized.isBlank) {
    issues.push(generateIssue('EMPTY_PARENT_ID', { field, id }));
  }

  if (id !== undefined && normalized.normalizedParentId !== undefined && normalized.normalizedParentId === id) {
    issues.push(generateIssue('SELF_PARENT', { field, id }));
  }

  return { hasValidParentId: issues.length === 0, normalizeParentId: normalized.normalizedParentId, issues };
}
