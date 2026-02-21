export function addToSetMap<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  const set = map.get(key);
  if (set) {
    set.add(value);
    return;
  }

  map.set(key, new Set([value]));
}
