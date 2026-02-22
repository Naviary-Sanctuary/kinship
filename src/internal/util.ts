import type { PedigreeId } from '../models/pedigree';

export function addToSetMap<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  const set = map.get(key);
  if (set) {
    set.add(value);
    return;
  }

  map.set(key, new Set([value]));
}

export function getPairKey(a: PedigreeId, b: PedigreeId): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}
