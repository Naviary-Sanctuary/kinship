import type { Individual, KinshipGraph, PartnerRelationship } from '../models/kinship';
import type { KinshipIssue } from '../models/issues';
import type { PedigreeId } from '../models/pedigree';
import { EMPTY_PEDIGREE_IDS, EMPTY_PARTNER_RELATIONSHIPS } from '../internal/constants';
import { getPairKey } from '../internal/util';

export function hasIndividual(graph: KinshipGraph, id: PedigreeId): boolean {
  return graph.individualsById.has(id);
}

export function getIndividual(graph: KinshipGraph, id: PedigreeId): Individual | undefined {
  return graph.individualsById.get(id);
}

export function getParentIds(graph: KinshipGraph, id: PedigreeId): readonly PedigreeId[] {
  return graph.parentsByChildId.get(id) ?? EMPTY_PEDIGREE_IDS;
}

export function getChildIds(graph: KinshipGraph, id: PedigreeId): readonly PedigreeId[] {
  return graph.childrenByParentId.get(id) ?? EMPTY_PEDIGREE_IDS;
}

export function getPartnerIds(graph: KinshipGraph, id: PedigreeId): readonly PedigreeId[] {
  return graph.partnersByIndividualId.get(id) ?? EMPTY_PEDIGREE_IDS;
}

export function getPartnerRelationships(graph: KinshipGraph, id: PedigreeId): readonly PartnerRelationship[] {
  const partnerIds = getPartnerIds(graph, id);
  if (partnerIds.length === 0) return EMPTY_PARTNER_RELATIONSHIPS;

  return partnerIds.reduce<PartnerRelationship[]>((list, partnerId) => {
    const relation = graph.partnerRelationshipsByPairKey.get(getPairKey(id, partnerId));
    if (relation !== undefined) list.push(relation);
    return list;
  }, []);
}

export function getIssues(graph: KinshipGraph): readonly KinshipIssue[] {
  return graph.issues;
}
