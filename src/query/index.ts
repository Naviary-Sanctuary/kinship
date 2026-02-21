import type { Individual, KinshipGraph, PartnerRelationShip } from '../models/kinship';
import type { KinshipIssue } from '../models/issues';
import type { PedigreeId } from '../models/pedigree';

const EMPTY_PEDIGREE_IDS = Object.freeze([]) as readonly PedigreeId[];
const EMPTY_PARTNER_RELATIONSHIPS = Object.freeze([]) as readonly PartnerRelationShip[];

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

export function getPartnerRelationships(graph: KinshipGraph, id: PedigreeId): readonly PartnerRelationShip[] {
  const partnerIds = getPartnerIds(graph, id);
  if (partnerIds.length === 0) return EMPTY_PARTNER_RELATIONSHIPS;

  return partnerIds.reduce<PartnerRelationShip[]>((list, partnerId) => {
    const relation = graph.partnerRelationshipsByPairKey.get(pairKey(id, partnerId));
    if (relation !== undefined) list.push(relation);
    return list;
  }, []);
}

export function getIssues(graph: KinshipGraph): readonly KinshipIssue[] {
  return graph.issues;
}

function pairKey(a: PedigreeId, b: PedigreeId): string {
  return a.localeCompare(b) <= 0 ? `${a}-${b}` : `${b}-${a}`;
}
