export type Operation = (...args: unknown[]) => unknown;
export type OperationMap = Record<string, Operation>;

export function mergeOperations(maps: OperationMap[]): OperationMap {
  if (maps.length === 0) throw new Error("no operation maps to merge");
  const out: OperationMap = {};
  for (const map of maps) {
    for (const [name, fn] of Object.entries(map)) {
      if (Object.hasOwn(out, name)) {
        throw new Error(`duplicate operation: ${name}`);
      }
      out[name] = fn;
    }
  }
  return out;
}

// Site-side parallel: section renderers. Imported from site, not pipeline,
// but the merge function is symmetric, so re-export the implementation.
export function mergeStringMaps<T>(maps: Record<string, T>[]): Record<string, T> {
  if (maps.length === 0) throw new Error("no maps to merge");
  const out: Record<string, T> = {};
  for (const map of maps) {
    for (const [k, v] of Object.entries(map)) {
      if (Object.hasOwn(out, k)) {
        throw new Error(`duplicate key: ${k}`);
      }
      out[k] = v;
    }
  }
  return out;
}
