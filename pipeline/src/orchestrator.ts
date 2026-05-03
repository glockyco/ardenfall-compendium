import type { Stage, StageContext } from "./types.ts";

/**
 * Run a topo-sorted DAG of stages. `seeds` provides initial named inputs that
 * stages can declare as inputs. Returns a record mapping stage id to its output,
 * merged with the seeds.
 */
export async function runStages(
  stages: Stage<unknown, unknown>[],
  seeds: Record<string, unknown>,
  ctx: StageContext,
): Promise<Record<string, unknown>> {
  const byId = new Map<string, Stage<unknown, unknown>>();
  for (const s of stages) {
    if (byId.has(s.id)) throw new Error(`duplicate stage id: ${s.id}`);
    byId.set(s.id, s);
  }

  // Validate inputs.
  for (const s of stages) {
    for (const input of s.inputs) {
      if (!byId.has(input) && !Object.hasOwn(seeds, input)) {
        throw new Error(`stage ${s.id}: unsatisfied input '${input}'`);
      }
    }
  }

  // Kahn's algorithm.
  const inDegree = new Map<string, number>();
  for (const s of stages) inDegree.set(s.id, s.inputs.filter((i) => byId.has(i)).length);
  const ready: string[] = [];
  for (const [id, deg] of inDegree) if (deg === 0) ready.push(id);

  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const other of stages) {
      if (other.inputs.includes(id)) {
        const next = (inDegree.get(other.id) ?? 0) - 1;
        inDegree.set(other.id, next);
        if (next === 0) ready.push(other.id);
      }
    }
  }

  if (order.length !== stages.length) {
    throw new Error("cycle detected in stage graph");
  }

  const outputs: Record<string, unknown> = { ...seeds };
  for (const id of order) {
    const s = byId.get(id)!;
    const inputs: Record<string, unknown> = {};
    for (const input of s.inputs) inputs[input] = outputs[input];
    outputs[id] = await s.run(inputs, ctx);
  }
  return outputs;
}
