/**
 * Merge sibling string-keyed maps into a single map.
 *
 * Throws on duplicate keys so callers can never silently shadow renderer
 * registrations from another entity (one of the failure modes the implementation
 * decisions spec §5 calls out).
 */
export function mergeStringMaps<T>(maps: Record<string, T>[]): Record<string, T> {
  if (maps.length === 0) throw new Error("no maps to merge");
  const out: Record<string, T> = {};
  for (const map of maps) {
    for (const [k, v] of Object.entries(map)) {
      if (Object.hasOwn(out, k)) throw new Error(`duplicate renderer: ${k}`);
      out[k] = v;
    }
  }
  return out;
}
