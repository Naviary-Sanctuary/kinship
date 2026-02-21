import { generateIssue } from '../models/issue-factory';
import type { KinshipIssue } from '../models/issues';
import type { PedigreeId, PedigreeRecord, PedigreeRecordInput } from '../models/pedigree';
import { validateRecord } from './validate-record';

export interface SanitizeRecordsResult {
  records: readonly PedigreeRecord[];
  issues: readonly KinshipIssue[];
}

/**
 * Sanitize a batch of pedigree records into graph-safe records.
 *
 * @param inputs - Raw input records from external sources (API/JSON/DB).
 * @returns Sanitized records and any non-blocking issues.
 */
export function sanitizeRecords(inputs: PedigreeRecordInput[]): SanitizeRecordsResult {
  const issues: KinshipIssue[] = [];

  const normalizedRecords = inputs
    .map((input) => {
      const result = validateRecord(input);
      issues.push(...result.issues);

      return result.record;
    })
    .filter((record): record is PedigreeRecord => !!record);

  const { deduplicated, issues: deduplicationIssues } = deduplicateRecords(normalizedRecords);
  issues.push(...deduplicationIssues);

  const { cleanedRecords, issues: pruningIssues } = pruneDanglingParentLinks(deduplicated);
  issues.push(...pruningIssues);

  return { records: cleanedRecords, issues };
}

/**
 * Deduplicate records by id.
 */
function deduplicateRecords(records: PedigreeRecord[]): { deduplicated: PedigreeRecord[]; issues: KinshipIssue[] } {
  const seenIds = new Set<PedigreeId>();
  const deduplicated: PedigreeRecord[] = [];
  const issues: KinshipIssue[] = [];

  records.forEach((record) => {
    if (!seenIds.has(record.id)) {
      seenIds.add(record.id);
      deduplicated.push(record);
    } else {
      issues.push(generateIssue('DUPLICATE_ID', { id: record.id }));
    }
  });

  return { deduplicated, issues };
}

/**
 * Prune dangling parent links.
 */
function pruneDanglingParentLinks(records: PedigreeRecord[]): {
  cleanedRecords: PedigreeRecord[];
  issues: KinshipIssue[];
} {
  const knownIds = new Set<PedigreeId>(records.map((record) => record.id));
  const issues: KinshipIssue[] = [];

  const cleanedRecords = records.map((record) => {
    const result: PedigreeRecord = { id: record.id };

    if (record.sireId !== undefined) {
      if (knownIds.has(record.sireId)) {
        result.sireId = record.sireId;
      } else {
        issues.push(generateIssue('MISSING_PARENT', { field: 'sireId', id: record.id }));
      }
    }

    if (record.damId !== undefined) {
      if (knownIds.has(record.damId)) {
        result.damId = record.damId;
      } else {
        issues.push(generateIssue('MISSING_PARENT', { field: 'damId', id: record.id }));
      }
    }

    return result;
  });

  return { cleanedRecords, issues };
}
