export type IndividualId = string;
export type PairId = string;
export type GraphNodeId = string;
export type GraphEdgeId = string;
export type ComponentId = string;

/**
 * Structural fields read from the Naviary Parrot model.
 * Other entity fields are intentionally excluded from the output graph.
 */
export interface KinshipParrotInput {
  readonly id: IndividualId;
  readonly fatherId?: IndividualId | null;
  readonly motherId?: IndividualId | null;
  readonly gender?: 'male' | 'female' | 'unknown';
}

/**
 * Structural fields read from the Naviary Pair model.
 * A Pair supplements partner history; it never creates parentage by itself.
 */
export interface KinshipPairInput {
  readonly id: PairId;
  readonly maleId: IndividualId;
  readonly femaleId: IndividualId;
}

export interface KinshipInput<
  TParrot extends KinshipParrotInput = KinshipParrotInput,
  TPair extends KinshipPairInput = KinshipPairInput,
> {
  readonly parrots: readonly TParrot[];
  readonly pairs?: readonly TPair[] | null;
}

export type ParentRole = 'father' | 'mother';
export type PartnerRole = 'male' | 'female';
export type FamilyOrigin = 'parentage' | 'pair' | 'both';
export type IndividualResolution = 'resolved' | 'unresolved';

export type KinshipIssueSeverity = 'warning' | 'error';

export type KinshipIssueCode =
  | 'INVALID_INPUT'
  | 'INVALID_PARROT'
  | 'INVALID_INDIVIDUAL_ID'
  | 'INVALID_GENDER'
  | 'DUPLICATE_INDIVIDUAL_ID'
  | 'INVALID_PARENT_ID'
  | 'SELF_PARENT'
  | 'SAME_PARENT'
  | 'PARENT_ROLE_CONFLICT'
  | 'PARENTAGE_CYCLE'
  | 'INVALID_PAIR'
  | 'INVALID_PAIR_ID'
  | 'DUPLICATE_PAIR_ID'
  | 'INVALID_PAIR_ENDPOINT_ID'
  | 'SELF_PAIR'
  | 'UNRESOLVED_INDIVIDUAL'
  | 'PAIR_ROLE_CONFLICT'
  | 'PARENT_GENDER_CONFLICT'
  | 'PAIR_GENDER_CONFLICT';

export interface KinshipIssue {
  readonly severity: KinshipIssueSeverity;
  readonly code: KinshipIssueCode;
  readonly message: string;
  readonly inputIndex?: number;
  readonly field?: 'parrots' | 'pairs' | 'id' | 'gender' | 'fatherId' | 'motherId' | 'maleId' | 'femaleId';
  readonly individualId?: IndividualId;
  readonly pairId?: PairId;
  readonly relatedIds?: readonly IndividualId[];
  readonly path?: readonly IndividualId[];
}

export interface KinshipIndividualNode {
  readonly id: GraphNodeId;
  readonly kind: 'individual';
  readonly individualId: IndividualId;
  readonly resolution: IndividualResolution;
  readonly gender: 'male' | 'female' | 'unknown';
  /**
   * Longest biological-parent path from a founder.
   * This is not a renderer rank or a y-coordinate.
   */
  readonly lineageDepth: number;
}

/**
 * A semantic junction between partners and their children.
 * Renderers can hide this node and draw the familiar horizontal couple line.
 */
export interface KinshipFamilyNode {
  readonly id: GraphNodeId;
  readonly kind: 'family';
  readonly pairIds: readonly PairId[];
  readonly origin: FamilyOrigin;
  readonly missingParentRoles: readonly ParentRole[];
  /**
   * Highest lineage depth among this family's known partners.
   * This is not a renderer rank or a y-coordinate.
   */
  readonly lineageDepth: number;
}

export type KinshipGraphNode = KinshipIndividualNode | KinshipFamilyNode;

export interface KinshipPartnerEdge {
  readonly id: GraphEdgeId;
  readonly kind: 'partner';
  readonly sourceNodeId: GraphNodeId;
  readonly targetNodeId: GraphNodeId;
  readonly role: PartnerRole;
}

export interface KinshipChildEdge {
  readonly id: GraphEdgeId;
  readonly kind: 'child';
  readonly sourceNodeId: GraphNodeId;
  readonly targetNodeId: GraphNodeId;
}

export type KinshipGraphEdge = KinshipPartnerEdge | KinshipChildEdge;

export interface KinshipComponent {
  readonly id: ComponentId;
  readonly nodeIds: readonly GraphNodeId[];
  readonly rootNodeIds: readonly GraphNodeId[];
  readonly minLineageDepth: number;
  readonly maxLineageDepth: number;
}

/**
 * Renderer-neutral and JSON-safe topology contract.
 * Presentation DTOs are joined by individualId and pairIds at the API boundary.
 */
export interface KinshipGraph {
  readonly schemaVersion: 1;
  readonly nodes: readonly KinshipGraphNode[];
  readonly edges: readonly KinshipGraphEdge[];
  readonly components: readonly KinshipComponent[];
}

export type BuildKinshipResult =
  | {
      readonly ok: true;
      readonly graph: KinshipGraph;
      readonly issues: readonly KinshipIssue[];
    }
  | {
      readonly ok: false;
      readonly issues: readonly KinshipIssue[];
    };
