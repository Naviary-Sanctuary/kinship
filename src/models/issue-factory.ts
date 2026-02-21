import type { Field, IssueCode, IssueLevel, KinshipIssue } from './issues';
import type { PedigreeId } from './pedigree';

type ParentField = Extract<Field, 'sireId' | 'damId'>;

type IssuePayload = {
  EMPTY_ID: {};
  EMPTY_PARENT_ID: { field: ParentField; id?: PedigreeId };
  SELF_PARENT: { field: ParentField; id?: PedigreeId };
  SAME_PARENT: { id?: PedigreeId };
  MISSING_PARENT: { field: ParentField; id?: PedigreeId };
  DUPLICATE_ID: { id?: PedigreeId; option?: { deduplicate?: boolean } };
  CYCLE_DETECTED: { id?: PedigreeId };
};

const issueLevels = {
  EMPTY_ID: () => 'error',
  EMPTY_PARENT_ID: () => 'error',
  SELF_PARENT: () => 'error',
  SAME_PARENT: () => 'error',
  MISSING_PARENT: () => 'error',
  DUPLICATE_ID: (payload: IssuePayload['DUPLICATE_ID']) => (payload.option?.deduplicate ? 'warning' : 'error'),
  CYCLE_DETECTED: () => 'fatal',
} satisfies { [K in IssueCode]: (payload: IssuePayload[K]) => IssueLevel };

const formatMessageMap = {
  EMPTY_ID: () => `id must not be empty or whitespace-only.`,
  EMPTY_PARENT_ID: (payload: IssuePayload['EMPTY_PARENT_ID']) =>
    `${payload.field} must not be empty or whitespace-only.`,
  SELF_PARENT: (payload: IssuePayload['SELF_PARENT']) => `${payload.field} must not be the same as individual id.`,
  SAME_PARENT: () => `Sire and Dam must not be same.`,
  MISSING_PARENT: (payload: IssuePayload['MISSING_PARENT']) => `${payload.field} is missing.`,
  DUPLICATE_ID: (payload: IssuePayload['DUPLICATE_ID']) => `Duplicate id found: ${payload.id}.`,
  CYCLE_DETECTED: (payload: IssuePayload['CYCLE_DETECTED']) => `Cycle detected starting at ${payload.id}.`,
} satisfies { [K in IssueCode]: (payload: IssuePayload[K]) => string };

type PayloadArg<C extends IssueCode> = keyof IssuePayload[C] extends never ? [] : [IssuePayload[C]];

/**
 * Generate a pedigree issue
 *
 * arguments are following the payload type of the issue code
 */
export function generateIssue<C extends IssueCode>(code: C, ...args: PayloadArg<C>): KinshipIssue {
  const payload = (args[0] ?? {}) as IssuePayload[C];

  const formatMessage = formatMessageMap[code] as (payload: IssuePayload[C]) => string;
  const level = issueLevels[code](payload);

  return {
    level,
    code,
    id: 'id' in payload ? payload.id : undefined,
    field: 'field' in payload ? payload.field : undefined,
    message: formatMessage(payload),
  };
}
