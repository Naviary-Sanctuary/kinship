export { build } from './core/build';

export { getAncestors, getDescendants, extractFamilyNetwork } from './query';

export { toMermaid } from './export';

export type {
  KinshipBuildOptions,
  KinshipGraph,
  Individual,
  KinshipLink,
  PartnerRelationship,
  RelationshipKind,
} from './models/kinship';
export type { PedigreeId, PedigreeRecordInput } from './models/pedigree';
export type { KinshipIssue, IssueLevel, IssueCode } from './models/issues';
export type { ExtractFamilyNetworkResult, TraversalOptions, TraversalVisit } from './query/types';
