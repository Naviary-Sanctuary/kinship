import type {
  BuildKinshipResult,
  GraphNodeId,
  KinshipComponent,
  KinshipFamilyNode,
  KinshipGraphEdge,
  KinshipGraphNode,
  KinshipIndividualNode,
  KinshipInput,
  KinshipIssue,
  KinshipPairInput,
  KinshipParrotInput,
  ParentRole,
  PartnerRole,
} from './model.js';

interface NormalizedParrot {
  readonly id: string;
  readonly fatherId?: string;
  readonly motherId?: string;
  readonly gender: 'male' | 'female' | 'unknown';
}

interface NormalizedPair {
  readonly id: string;
  readonly maleId: string;
  readonly femaleId: string;
}

interface ValidatedInput {
  readonly parrots: readonly NormalizedParrot[];
  readonly pairs: readonly NormalizedPair[];
  readonly issues: KinshipIssue[];
}

interface MutableFamily {
  readonly id: GraphNodeId;
  maleId?: string;
  femaleId?: string;
  readonly childIds: string[];
  readonly pairIds: string[];
  readonly missingParentRoles: ParentRole[];
  hasParentage: boolean;
  hasPair: boolean;
}

interface AssembledFamily {
  readonly node: KinshipFamilyNode;
  readonly partners: readonly {
    readonly individualId: string;
    readonly role: PartnerRole;
  }[];
  readonly childIds: readonly string[];
}

interface LineageOrder {
  readonly lineageDepthByIndividualId: ReadonlyMap<string, number>;
  readonly cycles: readonly {
    readonly individualIds: readonly string[];
    readonly path: readonly string[];
  }[];
}

interface ComponentAssignment {
  readonly components: readonly KinshipComponent[];
}

/**
 * Builds a renderer-neutral pedigree graph from Naviary Parrot records and
 * optional Pair records.
 */
export class Kinship<
  TParrot extends KinshipParrotInput = KinshipParrotInput,
  TPair extends KinshipPairInput = KinshipPairInput,
> {
  constructor(private readonly input: readonly TParrot[] | KinshipInput<TParrot, TPair>) {}

  build(): BuildKinshipResult {
    const validated = this.validateInput();
    const issues = [...validated.issues];

    if (issues.some((issue) => issue.severity === 'error')) {
      const sortedIssues = issues
        .map((issue) => ({ issue, sortKey: JSON.stringify(issue) }))
        .sort((left, right) => (left.sortKey < right.sortKey ? -1 : left.sortKey > right.sortKey ? 1 : 0))
        .map(({ issue }) => issue);
      return { ok: false, issues: sortedIssues };
    }

    const parrotsById = validated.parrots.reduce<Map<string, NormalizedParrot>>((records, parrot) => {
      records.set(parrot.id, parrot);
      return records;
    }, new Map());

    const individualIds = validated.parrots.reduce<Set<string>>((ids, parrot) => {
      ids.add(parrot.id);
      if (parrot.fatherId) ids.add(parrot.fatherId);
      if (parrot.motherId) ids.add(parrot.motherId);
      return ids;
    }, new Set());

    validated.pairs.forEach((pair) => {
      individualIds.add(pair.maleId);
      individualIds.add(pair.femaleId);
    });

    [...individualIds]
      .filter((individualId) => !parrotsById.has(individualId))
      .sort()
      .forEach((individualId) => {
        issues.push({
          severity: 'warning',
          code: 'UNRESOLVED_INDIVIDUAL',
          message: `Individual "${individualId}" is referenced but was not included in the Parrot input.`,
          individualId,
        });
      });

    const parentsByChildId = new Map<string, Set<string>>();
    const childrenByParentId = new Map<string, Set<string>>();

    validated.parrots.forEach((parrot) => {
      const parentIds = [parrot.fatherId, parrot.motherId].filter(
        (individualId): individualId is string => individualId !== undefined,
      );

      if (parentIds.length > 0) {
        parentsByChildId.set(parrot.id, new Set(parentIds));
      }

      parentIds.forEach((parentId) => {
        const childIds = childrenByParentId.get(parentId) ?? new Set<string>();
        childIds.add(parrot.id);
        childrenByParentId.set(parentId, childIds);
      });

      const father = parrot.fatherId ? parrotsById.get(parrot.fatherId) : undefined;
      const mother = parrot.motherId ? parrotsById.get(parrot.motherId) : undefined;

      if (father?.gender === 'female') {
        issues.push({
          severity: 'warning',
          code: 'PARENT_GENDER_CONFLICT',
          message: `Individual "${father.id}" is used as father of "${parrot.id}" but is recorded as female.`,
          individualId: parrot.id,
          field: 'fatherId',
          relatedIds: [father.id],
        });
      }

      if (mother?.gender === 'male') {
        issues.push({
          severity: 'warning',
          code: 'PARENT_GENDER_CONFLICT',
          message: `Individual "${mother.id}" is used as mother of "${parrot.id}" but is recorded as male.`,
          individualId: parrot.id,
          field: 'motherId',
          relatedIds: [mother.id],
        });
      }
    });

    validated.pairs.forEach((pair) => {
      const male = parrotsById.get(pair.maleId);
      const female = parrotsById.get(pair.femaleId);

      if (male?.gender === 'female') {
        issues.push({
          severity: 'warning',
          code: 'PAIR_GENDER_CONFLICT',
          message: `Pair "${pair.id}" uses "${male.id}" as male but the Parrot is recorded as female.`,
          pairId: pair.id,
          field: 'maleId',
          relatedIds: [male.id],
        });
      }

      if (female?.gender === 'male') {
        issues.push({
          severity: 'warning',
          code: 'PAIR_GENDER_CONFLICT',
          message: `Pair "${pair.id}" uses "${female.id}" as female but the Parrot is recorded as male.`,
          pairId: pair.id,
          field: 'femaleId',
          relatedIds: [female.id],
        });
      }
    });

    const parentRoleByIndividualId = new Map<string, PartnerRole>();
    const familiesById = new Map<GraphNodeId, MutableFamily>();

    validated.parrots.forEach((parrot) => {
      if (!parrot.fatherId && !parrot.motherId) return;

      const knownParentIds = [parrot.fatherId, parrot.motherId]
        .filter((individualId): individualId is string => individualId !== undefined)
        .sort();

      const familyId =
        knownParentIds.length === 2
          ? `family:${JSON.stringify(['partners', ...knownParentIds])}`
          : `family:${JSON.stringify([
              'single-parent',
              parrot.fatherId ? 'father' : 'mother',
              knownParentIds[0],
              parrot.id,
            ])}`;

      const family =
        familiesById.get(familyId) ??
        ({
          id: familyId,
          childIds: [],
          pairIds: [],
          missingParentRoles: [],
          hasParentage: false,
          hasPair: false,
        } satisfies MutableFamily);

      const expectedPartners = [
        parrot.fatherId ? ({ role: 'male', individualId: parrot.fatherId } as const) : undefined,
        parrot.motherId ? ({ role: 'female', individualId: parrot.motherId } as const) : undefined,
      ].filter(
        (
          partner,
        ): partner is {
          readonly role: PartnerRole;
          readonly individualId: string;
        } => partner !== undefined,
      );

      const conflictingPartners = expectedPartners.filter((partner) => {
        const currentRole = parentRoleByIndividualId.get(partner.individualId);
        return currentRole !== undefined && currentRole !== partner.role;
      });

      if (conflictingPartners.length > 0) {
        issues.push({
          severity: 'error',
          code: 'PARENT_ROLE_CONFLICT',
          message: `Parent roles on "${parrot.id}" conflict with earlier father or mother declarations.`,
          individualId: parrot.id,
          relatedIds: conflictingPartners.map((partner) => partner.individualId).sort(),
        });
      }

      expectedPartners.forEach((partner) => {
        const currentRole = parentRoleByIndividualId.get(partner.individualId);
        if (currentRole === undefined) {
          parentRoleByIndividualId.set(partner.individualId, partner.role);
        }
        if (currentRole === undefined || currentRole === partner.role) {
          if (partner.role === 'male') {
            family.maleId = partner.individualId;
          } else {
            family.femaleId = partner.individualId;
          }
        }
      });

      if (!parrot.fatherId) family.missingParentRoles.push('father');
      if (!parrot.motherId) family.missingParentRoles.push('mother');

      family.childIds.push(parrot.id);
      family.hasParentage = true;
      familiesById.set(familyId, family);
    });

    const pairRoleByIndividualId = new Map<string, PartnerRole>();

    validated.pairs.forEach((pair) => {
      const partnerIds = [pair.maleId, pair.femaleId].sort();
      const familyId = `family:${JSON.stringify(['partners', ...partnerIds])}`;
      const family =
        familiesById.get(familyId) ??
        ({
          id: familyId,
          childIds: [],
          pairIds: [],
          missingParentRoles: [],
          hasParentage: false,
          hasPair: false,
        } satisfies MutableFamily);

      const declaredPartners = [
        { role: 'male', individualId: pair.maleId },
        { role: 'female', individualId: pair.femaleId },
      ] as const;
      const pairRoleConflicts = declaredPartners.filter((partner) => {
        const currentRole = pairRoleByIndividualId.get(partner.individualId);
        return currentRole !== undefined && currentRole !== partner.role;
      });
      const parentageRoleConflicts = declaredPartners.filter((partner) => {
        const currentRole = parentRoleByIndividualId.get(partner.individualId);
        return currentRole !== undefined && currentRole !== partner.role;
      });
      const hasFamilyRoleConflict = declaredPartners.some((partner) => {
        const currentId = partner.role === 'male' ? family.maleId : family.femaleId;
        return currentId !== undefined && currentId !== partner.individualId;
      });

      if (pairRoleConflicts.length > 0) {
        issues.push({
          severity: 'error',
          code: 'PAIR_ROLE_CONFLICT',
          message: `Pair "${pair.id}" conflicts with earlier male or female Pair declarations.`,
          pairId: pair.id,
          relatedIds: pairRoleConflicts.map((partner) => partner.individualId).sort(),
        });
      }

      if (parentageRoleConflicts.length > 0) {
        issues.push({
          severity: family.hasParentage ? 'warning' : 'error',
          code: 'PAIR_ROLE_CONFLICT',
          message: family.hasParentage
            ? `Pair "${pair.id}" reverses the authoritative parent roles for this family.`
            : `Pair "${pair.id}" conflicts with authoritative parent roles declared in another family.`,
          pairId: pair.id,
          relatedIds: parentageRoleConflicts.map((partner) => partner.individualId).sort(),
        });
      }

      declaredPartners.forEach((partner) => {
        if (!pairRoleByIndividualId.has(partner.individualId)) {
          pairRoleByIndividualId.set(partner.individualId, partner.role);
        }
      });

      if (pairRoleConflicts.length === 0 && parentageRoleConflicts.length === 0 && !hasFamilyRoleConflict) {
        declaredPartners.forEach((partner) => {
          if (partner.role === 'male') {
            family.maleId = partner.individualId;
          } else {
            family.femaleId = partner.individualId;
          }
        });
      }

      family.pairIds.push(pair.id);
      family.hasPair = true;
      familiesById.set(familyId, family);
    });

    if (issues.some((issue) => issue.severity === 'error')) {
      const sortedIssues = issues
        .map((issue) => ({ issue, sortKey: JSON.stringify(issue) }))
        .sort((left, right) => (left.sortKey < right.sortKey ? -1 : left.sortKey > right.sortKey ? 1 : 0))
        .map(({ issue }) => issue);
      return { ok: false, issues: sortedIssues };
    }

    const lineageOrder = this.orderLineageDepths([...individualIds].sort(), parentsByChildId, childrenByParentId);

    if (lineageOrder.cycles.length > 0) {
      lineageOrder.cycles.forEach((cycle) => {
        issues.push({
          severity: 'error',
          code: 'PARENTAGE_CYCLE',
          message: `Parentage cycle detected: ${cycle.path.join(' -> ')}.`,
          path: cycle.path,
          relatedIds: cycle.individualIds,
        });
      });
      const sortedIssues = issues
        .map((issue) => ({ issue, sortKey: JSON.stringify(issue) }))
        .sort((left, right) => (left.sortKey < right.sortKey ? -1 : left.sortKey > right.sortKey ? 1 : 0))
        .map(({ issue }) => issue);
      return { ok: false, issues: sortedIssues };
    }

    const individualNodeIdByIndividualId = [...individualIds].reduce<Map<string, GraphNodeId>>(
      (nodeIds, individualId) => {
        nodeIds.set(individualId, `individual:${JSON.stringify(individualId)}`);
        return nodeIds;
      },
      new Map(),
    );

    const individualNodes = [...individualIds].sort().map<KinshipIndividualNode>((individualId) => {
      const parrot = parrotsById.get(individualId);
      return {
        id: individualNodeIdByIndividualId.get(individualId)!,
        kind: 'individual',
        individualId,
        resolution: parrot ? 'resolved' : 'unresolved',
        gender: parrot?.gender ?? 'unknown',
        lineageDepth: lineageOrder.lineageDepthByIndividualId.get(individualId) ?? 0,
      };
    });

    const assembledFamilies = [...familiesById.values()]
      .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
      .map<AssembledFamily>((family) => {
        const partners = (
          [
            family.maleId
              ? {
                  role: 'male' as const,
                  individualId: family.maleId,
                }
              : undefined,
            family.femaleId
              ? {
                  role: 'female' as const,
                  individualId: family.femaleId,
                }
              : undefined,
          ] as const
        ).filter(
          (
            partner,
          ): partner is {
            readonly role: PartnerRole;
            readonly individualId: string;
          } => partner !== undefined,
        );

        const lineageDepth = partners.reduce(
          (highestDepth, partner) =>
            Math.max(highestDepth, lineageOrder.lineageDepthByIndividualId.get(partner.individualId) ?? 0),
          0,
        );

        return {
          node: {
            id: family.id,
            kind: 'family',
            pairIds: [...family.pairIds].sort(),
            origin: family.hasParentage && family.hasPair ? 'both' : family.hasParentage ? 'parentage' : 'pair',
            missingParentRoles: [...family.missingParentRoles].sort(),
            lineageDepth,
          },
          partners,
          childIds: [...family.childIds].sort(),
        };
      });

    const edges = assembledFamilies
      .reduce<KinshipGraphEdge[]>((familyEdges, family) => {
        family.partners.forEach((partner) => {
          familyEdges.push({
            id: `edge:${JSON.stringify(['partner', partner.individualId, family.node.id])}`,
            kind: 'partner',
            sourceNodeId: individualNodeIdByIndividualId.get(partner.individualId)!,
            targetNodeId: family.node.id,
            role: partner.role,
          });
        });
        family.childIds.forEach((childId) => {
          familyEdges.push({
            id: `edge:${JSON.stringify(['child', family.node.id, childId])}`,
            kind: 'child',
            sourceNodeId: family.node.id,
            targetNodeId: individualNodeIdByIndividualId.get(childId)!,
          });
        });
        return familyEdges;
      }, [])
      .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

    const nodes: readonly KinshipGraphNode[] = [...individualNodes, ...assembledFamilies.map((family) => family.node)];
    const componentAssignment = this.assignComponents(nodes, edges);

    const sortedIssues = issues
      .map((issue) => ({ issue, sortKey: JSON.stringify(issue) }))
      .sort((left, right) => (left.sortKey < right.sortKey ? -1 : left.sortKey > right.sortKey ? 1 : 0))
      .map(({ issue }) => issue);

    return {
      ok: true,
      graph: {
        schemaVersion: 1,
        nodes,
        edges,
        components: componentAssignment.components,
      },
      issues: sortedIssues,
    };
  }

  private validateInput(): ValidatedInput {
    const issues: KinshipIssue[] = [];
    const rawInput: unknown = this.input;
    const normalizedInput = Array.isArray(rawInput) ? { parrots: rawInput, pairs: undefined } : rawInput;

    if (typeof normalizedInput !== 'object' || normalizedInput === null || !('parrots' in normalizedInput)) {
      return {
        parrots: [],
        pairs: [],
        issues: [
          {
            severity: 'error',
            code: 'INVALID_INPUT',
            message: 'Kinship input must be a Parrot array or an object containing a parrots array.',
          },
        ],
      };
    }

    const inputRecord = normalizedInput as {
      readonly parrots?: unknown;
      readonly pairs?: unknown;
    };

    if (!Array.isArray(inputRecord.parrots)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_INPUT',
        message: 'The parrots field must be an array.',
        field: 'parrots',
      });
    }

    if (inputRecord.pairs !== undefined && inputRecord.pairs !== null && !Array.isArray(inputRecord.pairs)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_INPUT',
        message: 'The pairs field must be an array when provided.',
        field: 'pairs',
      });
    }

    const parrotIds = new Set<string>();
    const parrotInput: readonly unknown[] = Array.isArray(inputRecord.parrots) ? inputRecord.parrots : [];
    let firstMissingParrotIndex = 0;

    while (firstMissingParrotIndex < parrotInput.length && Object.hasOwn(parrotInput, firstMissingParrotIndex)) {
      firstMissingParrotIndex += 1;
    }

    if (firstMissingParrotIndex < parrotInput.length) {
      issues.push({
        severity: 'error',
        code: 'INVALID_PARROT',
        message: `Parrot input at index ${firstMissingParrotIndex} is missing; sparse arrays are not supported.`,
        inputIndex: firstMissingParrotIndex,
        field: 'parrots',
      });
    }

    const parrots = Reflect.apply(
      Array.prototype.reduce,
      firstMissingParrotIndex === parrotInput.length ? parrotInput : [],
      [
        (records: NormalizedParrot[], value: unknown, inputIndex: number) => {
          if (typeof value !== 'object' || value === null) {
            issues.push({
              severity: 'error',
              code: 'INVALID_PARROT',
              message: `Parrot input at index ${inputIndex} must be an object.`,
              inputIndex,
              field: 'parrots',
            });
            return records;
          }

          const record = value as Record<string, unknown>;
          if (typeof record.id !== 'string' || record.id.length === 0 || record.id !== record.id.trim()) {
            issues.push({
              severity: 'error',
              code: 'INVALID_INDIVIDUAL_ID',
              message: `Parrot input at index ${inputIndex} must have a non-empty, trimmed string id.`,
              inputIndex,
              field: 'id',
            });
            return records;
          }
          const id = record.id;

          const isDuplicate = parrotIds.has(id);
          if (isDuplicate) {
            issues.push({
              severity: 'error',
              code: 'DUPLICATE_INDIVIDUAL_ID',
              message: `Parrot id "${id}" appears more than once.`,
              inputIndex,
              field: 'id',
              individualId: id,
            });
          } else {
            parrotIds.add(id);
          }

          const parents = (
            [
              { field: 'fatherId' as const, value: record.fatherId },
              { field: 'motherId' as const, value: record.motherId },
            ] as const
          ).reduce<{
            fatherId?: string;
            motherId?: string;
          }>((normalizedParents, parent) => {
            if (parent.value === undefined || parent.value === null) {
              return normalizedParents;
            }

            if (typeof parent.value !== 'string' || parent.value.length === 0 || parent.value !== parent.value.trim()) {
              issues.push({
                severity: 'error',
                code: 'INVALID_PARENT_ID',
                message: `${parent.field} of "${id}" must be a non-empty, trimmed string when provided.`,
                inputIndex,
                field: parent.field,
                individualId: id,
              });
              return normalizedParents;
            }

            if (parent.value === id) {
              issues.push({
                severity: 'error',
                code: 'SELF_PARENT',
                message: `Individual "${id}" cannot be its own parent.`,
                inputIndex,
                field: parent.field,
                individualId: id,
              });
              return normalizedParents;
            }

            normalizedParents[parent.field] = parent.value;
            return normalizedParents;
          }, {});

          if (parents.fatherId && parents.motherId && parents.fatherId === parents.motherId) {
            issues.push({
              severity: 'error',
              code: 'SAME_PARENT',
              message: `Individual "${id}" cannot use the same individual as both father and mother.`,
              inputIndex,
              individualId: id,
              relatedIds: [parents.fatherId],
            });
          }

          const hasValidGender =
            record.gender === undefined ||
            record.gender === 'male' ||
            record.gender === 'female' ||
            record.gender === 'unknown';

          if (!hasValidGender) {
            issues.push({
              severity: 'error',
              code: 'INVALID_GENDER',
              message: `Gender of "${id}" must be "male", "female", or "unknown" when provided.`,
              inputIndex,
              field: 'gender',
              individualId: id,
            });
          }

          if (!isDuplicate) {
            records.push({
              id,
              ...(parents.fatherId ? { fatherId: parents.fatherId } : {}),
              ...(parents.motherId ? { motherId: parents.motherId } : {}),
              gender:
                record.gender === 'male' || record.gender === 'female' || record.gender === 'unknown'
                  ? record.gender
                  : 'unknown',
            });
          }
          return records;
        },
        [] as NormalizedParrot[],
      ],
    ) as NormalizedParrot[];

    const pairIds = new Set<string>();
    const pairInput: readonly unknown[] = Array.isArray(inputRecord.pairs) ? inputRecord.pairs : [];
    let firstMissingPairIndex = 0;

    while (firstMissingPairIndex < pairInput.length && Object.hasOwn(pairInput, firstMissingPairIndex)) {
      firstMissingPairIndex += 1;
    }

    if (firstMissingPairIndex < pairInput.length) {
      issues.push({
        severity: 'error',
        code: 'INVALID_PAIR',
        message: `Pair input at index ${firstMissingPairIndex} is missing; sparse arrays are not supported.`,
        inputIndex: firstMissingPairIndex,
        field: 'pairs',
      });
    }

    const pairs = Reflect.apply(Array.prototype.reduce, firstMissingPairIndex === pairInput.length ? pairInput : [], [
      (records: NormalizedPair[], value: unknown, inputIndex: number) => {
        if (typeof value !== 'object' || value === null) {
          issues.push({
            severity: 'error',
            code: 'INVALID_PAIR',
            message: `Pair input at index ${inputIndex} must be an object.`,
            inputIndex,
            field: 'pairs',
          });
          return records;
        }

        const record = value as Record<string, unknown>;
        if (typeof record.id !== 'string' || record.id.length === 0 || record.id !== record.id.trim()) {
          issues.push({
            severity: 'error',
            code: 'INVALID_PAIR_ID',
            message: `Pair input at index ${inputIndex} must have a non-empty, trimmed string id.`,
            inputIndex,
            field: 'id',
          });
          return records;
        }
        const id = record.id;

        const isDuplicate = pairIds.has(id);
        if (isDuplicate) {
          issues.push({
            severity: 'error',
            code: 'DUPLICATE_PAIR_ID',
            message: `Pair id "${id}" appears more than once.`,
            inputIndex,
            field: 'id',
            pairId: id,
          });
        } else {
          pairIds.add(id);
        }

        const endpoints = (
          [
            { field: 'maleId' as const, value: record.maleId },
            { field: 'femaleId' as const, value: record.femaleId },
          ] as const
        ).reduce<{
          maleId?: string;
          femaleId?: string;
        }>((normalizedEndpoints, endpoint) => {
          if (
            typeof endpoint.value !== 'string' ||
            endpoint.value.length === 0 ||
            endpoint.value !== endpoint.value.trim()
          ) {
            issues.push({
              severity: 'error',
              code: 'INVALID_PAIR_ENDPOINT_ID',
              message: `${endpoint.field} of Pair "${id}" must be a non-empty, trimmed string.`,
              inputIndex,
              field: endpoint.field,
              pairId: id,
            });
            return normalizedEndpoints;
          }

          normalizedEndpoints[endpoint.field] = endpoint.value;
          return normalizedEndpoints;
        }, {});

        if (endpoints.maleId && endpoints.femaleId && endpoints.maleId === endpoints.femaleId) {
          issues.push({
            severity: 'error',
            code: 'SELF_PAIR',
            message: `Pair "${id}" cannot connect an individual to itself.`,
            inputIndex,
            pairId: id,
            relatedIds: [endpoints.maleId],
          });
        }

        if (!isDuplicate && endpoints.maleId && endpoints.femaleId) {
          records.push({
            id,
            maleId: endpoints.maleId,
            femaleId: endpoints.femaleId,
          });
        }
        return records;
      },
      [] as NormalizedPair[],
    ]) as NormalizedPair[];

    parrots.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
    pairs.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

    return { parrots, pairs, issues };
  }

  private orderLineageDepths(
    individualIds: readonly string[],
    parentsByChildId: ReadonlyMap<string, ReadonlySet<string>>,
    childrenByParentId: ReadonlyMap<string, ReadonlySet<string>>,
  ): LineageOrder {
    const remainingParentCount = individualIds.reduce<Map<string, number>>((counts, individualId) => {
      counts.set(individualId, parentsByChildId.get(individualId)?.size ?? 0);
      return counts;
    }, new Map());
    const lineageDepthByIndividualId = individualIds.reduce<Map<string, number>>((depths, individualId) => {
      depths.set(individualId, 0);
      return depths;
    }, new Map());
    const queue = individualIds.filter((individualId) => remainingParentCount.get(individualId) === 0);
    let queueIndex = 0;
    let processedCount = 0;

    while (queueIndex < queue.length) {
      const parentId = queue[queueIndex]!;
      queueIndex += 1;
      processedCount += 1;

      [...(childrenByParentId.get(parentId) ?? [])].sort().forEach((childId) => {
        lineageDepthByIndividualId.set(
          childId,
          Math.max(lineageDepthByIndividualId.get(childId) ?? 0, (lineageDepthByIndividualId.get(parentId) ?? 0) + 1),
        );

        const nextParentCount = (remainingParentCount.get(childId) ?? 0) - 1;
        remainingParentCount.set(childId, nextParentCount);
        if (nextParentCount === 0) queue.push(childId);
      });
    }

    if (processedCount === individualIds.length) {
      return { lineageDepthByIndividualId, cycles: [] };
    }

    const cycleCandidateIds = individualIds.filter((individualId) => (remainingParentCount.get(individualId) ?? 0) > 0);
    const cycleCandidateIdSet = new Set(cycleCandidateIds);
    const visitedIndividualIds = new Set<string>();
    const finishOrder: string[] = [];

    cycleCandidateIds.forEach((candidateId) => {
      if (visitedIndividualIds.has(candidateId)) return;

      const stack: Array<{
        readonly individualId: string;
        readonly parentIds: readonly string[];
        parentIndex: number;
      }> = [
        {
          individualId: candidateId,
          parentIds: [...(parentsByChildId.get(candidateId) ?? [])]
            .filter((parentId) => cycleCandidateIdSet.has(parentId))
            .sort(),
          parentIndex: 0,
        },
      ];
      visitedIndividualIds.add(candidateId);

      while (stack.length > 0) {
        const frame = stack[stack.length - 1]!;

        if (frame.parentIndex >= frame.parentIds.length) {
          finishOrder.push(frame.individualId);
          stack.pop();
          continue;
        }

        const parentId = frame.parentIds[frame.parentIndex]!;
        frame.parentIndex += 1;
        if (visitedIndividualIds.has(parentId)) continue;

        visitedIndividualIds.add(parentId);
        stack.push({
          individualId: parentId,
          parentIds: [...(parentsByChildId.get(parentId) ?? [])]
            .filter((nextParentId) => cycleCandidateIdSet.has(nextParentId))
            .sort(),
          parentIndex: 0,
        });
      }
    });

    const assignedIndividualIds = new Set<string>();
    const cyclicComponents: string[][] = [];
    let finishIndex = finishOrder.length - 1;

    while (finishIndex >= 0) {
      const candidateId = finishOrder[finishIndex]!;
      finishIndex -= 1;
      if (assignedIndividualIds.has(candidateId)) continue;

      const componentIds: string[] = [];
      const stack = [candidateId];
      assignedIndividualIds.add(candidateId);

      while (stack.length > 0) {
        const individualId = stack.pop()!;
        componentIds.push(individualId);

        [...(childrenByParentId.get(individualId) ?? [])]
          .filter((childId) => cycleCandidateIdSet.has(childId))
          .sort()
          .reverse()
          .forEach((childId) => {
            if (assignedIndividualIds.has(childId)) return;
            assignedIndividualIds.add(childId);
            stack.push(childId);
          });
      }

      componentIds.sort();
      if (
        componentIds.length > 1 ||
        (componentIds[0] !== undefined && parentsByChildId.get(componentIds[0])?.has(componentIds[0]))
      ) {
        cyclicComponents.push(componentIds);
      }
    }

    const cycles = cyclicComponents
      .sort((left, right) => (left[0]! < right[0]! ? -1 : left[0]! > right[0]! ? 1 : 0))
      .map((componentIds) => {
        const componentIdSet = new Set(componentIds);
        const firstPathIndexByIndividualId = new Map<string, number>();
        const pathToCycle: string[] = [];
        let individualId = componentIds[0]!;

        while (!firstPathIndexByIndividualId.has(individualId)) {
          firstPathIndexByIndividualId.set(individualId, pathToCycle.length);
          pathToCycle.push(individualId);
          individualId = [...(parentsByChildId.get(individualId) ?? [])]
            .filter((parentId) => componentIdSet.has(parentId))
            .sort()[0]!;
        }

        return {
          individualIds: componentIds,
          path: [...pathToCycle.slice(firstPathIndexByIndividualId.get(individualId)!), individualId],
        };
      });

    return { lineageDepthByIndividualId, cycles };
  }

  private assignComponents(
    nodes: readonly KinshipGraphNode[],
    edges: readonly KinshipGraphEdge[],
  ): ComponentAssignment {
    const nodeIndexById = nodes.reduce<Map<GraphNodeId, number>>((index, node, nodeIndex) => {
      index.set(node.id, nodeIndex);
      return index;
    }, new Map());
    const parentIndexes = new Int32Array(nodes.length);
    const componentSizes = new Uint32Array(nodes.length);
    const hasBiologicalParent = new Uint8Array(nodes.length);

    parentIndexes.forEach((_, nodeIndex) => {
      parentIndexes[nodeIndex] = nodeIndex;
      componentSizes[nodeIndex] = 1;
    });

    edges.forEach((edge) => {
      const sourceIndex = nodeIndexById.get(edge.sourceNodeId)!;
      const targetIndex = nodeIndexById.get(edge.targetNodeId)!;
      let sourceRootIndex = sourceIndex;
      let targetRootIndex = targetIndex;

      while (parentIndexes[sourceRootIndex] !== sourceRootIndex) {
        parentIndexes[sourceRootIndex] = parentIndexes[parentIndexes[sourceRootIndex]!]!;
        sourceRootIndex = parentIndexes[sourceRootIndex]!;
      }
      while (parentIndexes[targetRootIndex] !== targetRootIndex) {
        parentIndexes[targetRootIndex] = parentIndexes[parentIndexes[targetRootIndex]!]!;
        targetRootIndex = parentIndexes[targetRootIndex]!;
      }

      if (sourceRootIndex !== targetRootIndex) {
        const sourceSize = componentSizes[sourceRootIndex]!;
        const targetSize = componentSizes[targetRootIndex]!;
        const shouldAttachSource =
          sourceSize < targetSize || (sourceSize === targetSize && sourceRootIndex > targetRootIndex);
        const childRootIndex = shouldAttachSource ? sourceRootIndex : targetRootIndex;
        const parentRootIndex = shouldAttachSource ? targetRootIndex : sourceRootIndex;
        parentIndexes[childRootIndex] = parentRootIndex;
        componentSizes[parentRootIndex] = sourceSize + targetSize;
      }

      if (edge.kind === 'child') {
        hasBiologicalParent[targetIndex] = 1;
      }
    });

    const componentsByRootIndex = nodes.reduce<
      Map<
        number,
        {
          readonly nodeIds: GraphNodeId[];
          readonly rootNodeIds: GraphNodeId[];
          minimumLineageDepth: number;
          maximumLineageDepth: number;
        }
      >
    >((components, node, nodeIndex) => {
      let rootIndex = nodeIndex;
      while (parentIndexes[rootIndex] !== rootIndex) {
        parentIndexes[rootIndex] = parentIndexes[parentIndexes[rootIndex]!]!;
        rootIndex = parentIndexes[rootIndex]!;
      }

      const component = components.get(rootIndex) ?? {
        nodeIds: [],
        rootNodeIds: [],
        minimumLineageDepth: Number.POSITIVE_INFINITY,
        maximumLineageDepth: Number.NEGATIVE_INFINITY,
      };
      component.nodeIds.push(node.id);
      if (node.kind === 'individual' && hasBiologicalParent[nodeIndex] === 0) {
        component.rootNodeIds.push(node.id);
      }
      component.minimumLineageDepth = Math.min(component.minimumLineageDepth, node.lineageDepth);
      component.maximumLineageDepth = Math.max(component.maximumLineageDepth, node.lineageDepth);
      components.set(rootIndex, component);
      return components;
    }, new Map());

    const components = [...componentsByRootIndex.values()]
      .map<KinshipComponent>((component) => {
        component.nodeIds.sort();
        component.rootNodeIds.sort();
        return {
          id: `component:${JSON.stringify(component.nodeIds[0])}`,
          nodeIds: component.nodeIds,
          rootNodeIds: component.rootNodeIds,
          minLineageDepth: component.minimumLineageDepth,
          maxLineageDepth: component.maximumLineageDepth,
        };
      })
      .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

    return { components };
  }
}
