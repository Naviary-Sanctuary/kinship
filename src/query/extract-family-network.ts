import { EMPTY_PEDIGREE_IDS } from '../internal/constants';
import type { Individual, KinshipGraph, KinshipLink } from '../models/kinship';
import type { PedigreeId } from '../models/pedigree';
import { getAncestors, getDescendants } from './traversal';
import type { ExtractFamilyNetworkResult } from './types';

/**
 * Deduplication is required because the same structural edge can be discovered
 * from multiple traversal paths, and renderers require deterministic edge sets.
 */
function dedupeLinks(links: readonly KinshipLink[]): readonly KinshipLink[] {
  const uniqueByKey = links.reduce((map, link) => {
    const key = `${link.kind}-${link.fromId}-${link.toId}`;
    if (!map.has(key)) {
      map.set(key, link);
    }
    return map;
  }, new Map<string, KinshipLink>());

  return [...uniqueByKey.values()];
}

export function extractFamilyNetwork(graph: KinshipGraph, id: PedigreeId): ExtractFamilyNetworkResult {
  if (!graph.individualsById.has(id)) {
    return {
      focusId: id,
      ancestorIds: [],
      descendantIds: [],
      partnerIds: [],
      individuals: [],
      links: [],
    };
  }

  const ancestorIds = [...getAncestors(graph, id)];
  const descendantIds = [...getDescendants(graph, id)];

  /**
   * coreSet models the direct lineage scope.
   */
  const coreSet = [id, ...ancestorIds, ...descendantIds].reduce((set, currentId) => {
    if (graph.individualsById.has(currentId)) {
      set.add(currentId);
    }
    return set;
  }, new Set<PedigreeId>());

  /**
   * partnerSet is derived only from core lineage members
   */
  const partnerSet = [...coreSet].reduce((set, currentId) => {
    (graph.partnersByIndividualId.get(currentId) ?? EMPTY_PEDIGREE_IDS).forEach((partnerId) => {
      if (graph.individualsById.has(partnerId)) {
        set.add(partnerId);
      }
    });
    return set;
  }, new Set<PedigreeId>());

  const partnerIds = [...partnerSet].filter((partnerId) => !coreSet.has(partnerId));

  /**
   * includedSet is the final node scope used by both node and edge extraction,
   * ensuring all emitted links always reference returned individuals.
   */
  const includedSet = partnerIds.reduce((set, partnerId) => {
    set.add(partnerId);
    return set;
  }, new Set<PedigreeId>(coreSet));

  const individuals = [...includedSet].reduce((list, individualId) => {
    const individual = graph.individualsById.get(individualId);
    if (individual !== undefined) {
      list.push(individual);
    }
    return list;
  }, [] as Individual[]);

  /**
   * DESCENT links are reconstructed from parent adjacency to keep a single,
   * direction-consistent representation (parent -> child) for render engines.
   */
  const descentLinks = [...includedSet].reduce((list, childId) => {
    (graph.parentsByChildId.get(childId) ?? EMPTY_PEDIGREE_IDS).forEach((parentId) => {
      if (includedSet.has(parentId)) {
        list.push({
          kind: 'DESCENT',
          fromId: parentId,
          toId: childId,
        });
      }
    });
    return list;
  }, [] as KinshipLink[]);

  /**
   * PARTNER links are taken from normalized pair relationships because pair keys
   * already encode canonical identity and reduce symmetry-related duplication.
   *
   * touchesCore guard is required to prevent partner-of-partner chains from
   * silently inflating the subgraph beyond the requested family neighborhood.
   */
  const partnerLinks = [...graph.partnerRelationshipsByPairKey.values()].reduce<KinshipLink[]>((list, relation) => {
    const includesBoth = includedSet.has(relation.individualAId) && includedSet.has(relation.individualBId);
    if (!includesBoth) return list;

    const touchesCore = coreSet.has(relation.individualAId) || coreSet.has(relation.individualBId);
    if (!touchesCore) return list;

    list.push({
      kind: 'PARTNER',
      fromId: relation.individualAId,
      toId: relation.individualBId,
    });
    return list;
  }, []);

  return {
    focusId: id,
    ancestorIds,
    descendantIds,
    partnerIds,
    individuals,
    links: dedupeLinks([...descentLinks, ...partnerLinks]),
  };
}
