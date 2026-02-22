import { addToSetMap, getPairKey } from '../internal/util';
import type {
  BuildKinshipGraphResult,
  Individual,
  KinshipBuildOptions,
  KinshipGraph,
  PartnerRelationship,
} from '../models/kinship';
import type { PedigreeId, PedigreeRecord, PedigreeRecordInput } from '../models/pedigree';
import { sanitizeRecords } from '../validate';
import { EMPTY_PEDIGREE_IDS } from '../internal/constants';

interface MutablePartnerRelationShip {
  pairKey: string;
  individualAId: PedigreeId;
  individualBId: PedigreeId;
  sharedChildIds: Set<PedigreeId>;
}

/**
 * Build a normalized kinship graph state from raw pedigree records.
 * The graph keeps descent and partner relations in separate indexes
 */
export function build(inputs: PedigreeRecordInput[], options?: KinshipBuildOptions): BuildKinshipGraphResult {
  // TODO: reserved for phase 2
  // const normalizedOptions: Required<KinshipBuildOptions> = {
  //   detectCycles: options?.detectCycles ?? true,
  //   maxBiologicalParents:
  //     options?.maxBiologicalParents && Number.isInteger(options.maxBiologicalParents)
  //       ? options.maxBiologicalParents
  //       : 2,
  // };

  const { records, issues } = sanitizeRecords(inputs);

  const fatal = issues.find((issue) => issue.level === 'fatal');
  if (fatal) return { ok: false, fatal, issues };

  const { recordsById, parentSetByChildId, childSetByParentId, partnerSetByIndividualId, mutablePartnerByPairKey } =
    records.reduce(
      (acc, record) => {
        acc.recordsById.set(record.id, record);

        // Descent logic
        const parents = [record.sireId, record.damId].filter((id): id is PedigreeId => id !== undefined);
        parents.forEach((parentId) => {
          addToSetMap(acc.parentSetByChildId, record.id, parentId);
          addToSetMap(acc.childSetByParentId, parentId, record.id);
        });

        // Partner logic
        if (record.sireId && record.damId && record.sireId !== record.damId) {
          const pairKey = getPairKey(record.sireId, record.damId);

          addToSetMap(acc.partnerSetByIndividualId, record.sireId, record.damId);
          addToSetMap(acc.partnerSetByIndividualId, record.damId, record.sireId);

          const existing = acc.mutablePartnerByPairKey.get(pairKey);
          if (existing) {
            existing.sharedChildIds.add(record.id);
          } else {
            acc.mutablePartnerByPairKey.set(pairKey, {
              pairKey,
              individualAId: record.sireId < record.damId ? record.sireId : record.damId,
              individualBId: record.sireId < record.damId ? record.damId : record.sireId,
              sharedChildIds: new Set([record.id]),
            });
          }
        }

        return acc;
      },
      {
        recordsById: new Map<PedigreeId, PedigreeRecord>(),
        parentSetByChildId: new Map<PedigreeId, Set<PedigreeId>>(),
        childSetByParentId: new Map<PedigreeId, Set<PedigreeId>>(),
        partnerSetByIndividualId: new Map<PedigreeId, Set<PedigreeId>>(),
        mutablePartnerByPairKey: new Map<string, MutablePartnerRelationShip>(),
      },
    );

  const parentsByChildId = finalizeAdjacencyMap(parentSetByChildId);
  const childrenByParentId = finalizeAdjacencyMap(childSetByParentId);
  const partnersByIndividualId = finalizeAdjacencyMap(partnerSetByIndividualId);

  const individualsById = [...recordsById.keys()].reduce<Map<PedigreeId, Individual>>((map, id) => {
    map.set(
      id,
      Object.freeze({
        id,
        parentIds: parentsByChildId.get(id) ?? EMPTY_PEDIGREE_IDS,
        childIds: childrenByParentId.get(id) ?? EMPTY_PEDIGREE_IDS,
      }),
    );
    return map;
  }, new Map<PedigreeId, Individual>());

  const partnerRelationshipsByPairKey = [...mutablePartnerByPairKey.entries()].reduce<Map<string, PartnerRelationship>>(
    (map, [pairKey, relation]) => {
      map.set(
        pairKey,
        Object.freeze({
          pairKey: relation.pairKey,
          individualAId: relation.individualAId,
          individualBId: relation.individualBId,
          sharedChildIds: Object.freeze([...relation.sharedChildIds]),
        }),
      );
      return map;
    },
    new Map<string, PartnerRelationship>(),
  );

  const graph: KinshipGraph = {
    recordsById,
    individualsById,
    parentsByChildId,
    childrenByParentId,
    partnersByIndividualId,
    partnerRelationshipsByPairKey,
    issues,
  };

  return { ok: true, graph, issues };
}

function finalizeAdjacencyMap(
  source: Map<PedigreeId, Set<PedigreeId>>,
): ReadonlyMap<PedigreeId, readonly PedigreeId[]> {
  return new Map([...source].map(([key, ids]) => [key, Object.freeze([...ids]) as readonly PedigreeId[]]));
}
