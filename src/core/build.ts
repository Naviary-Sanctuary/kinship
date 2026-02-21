import { addToSetMap } from '../internal/util';
import type {
  BuildKinshipGraphResult,
  Individual,
  KinshipBuildOptions,
  KinshipGraph,
  PartnerRelationShip,
} from '../models/kinship';
import type { PedigreeId, PedigreeRecord, PedigreeRecordInput } from '../models/pedigree';
import { sanitizeRecords } from '../validate';

const EMPTY_PEDIGREE_IDS = Object.freeze([]) as readonly PedigreeId[];

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

        if (record.sireId) {
          addToSetMap(acc.parentSetByChildId, record.id, record.sireId);
          addToSetMap(acc.childSetByParentId, record.sireId, record.id);
        }
        if (record.damId) {
          addToSetMap(acc.parentSetByChildId, record.id, record.damId);
          addToSetMap(acc.childSetByParentId, record.damId, record.id);
        }

        if (record.sireId && record.damId && record.sireId !== record.damId) {
          const [individualAId, individualBId] = [record.sireId, record.damId].toSorted((a, b) => a.localeCompare(b));
          const pairKey = `${individualAId}-${individualBId}`;

          addToSetMap(acc.partnerSetByIndividualId, individualAId, individualBId);
          addToSetMap(acc.partnerSetByIndividualId, individualBId, individualAId);

          const existing = acc.mutablePartnerByPairKey.get(pairKey);
          if (existing) {
            existing.sharedChildIds.add(record.id);
          } else {
            acc.mutablePartnerByPairKey.set(pairKey, {
              pairKey,
              individualAId,
              individualBId,
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

  const partnerRelationshipsByPairKey = [...mutablePartnerByPairKey.entries()].reduce<Map<string, PartnerRelationShip>>(
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
    new Map<string, PartnerRelationShip>(),
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
