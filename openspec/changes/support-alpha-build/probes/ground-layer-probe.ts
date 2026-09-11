// What draws the ground of a streamed cell, on which layer, with which shader.
import { connect } from "../../../../controller/node_modules/@hotrepl/sdk/dist/index.js";

const session = await connect({ url: process.env["HOTREPL_URL"] ?? "ws://127.0.0.1:18590" });
const ev = async (code: string) => {
  const r = await session.eval<unknown>(code, 60_000);
  process.stdout.write(
    `${code.slice(0, 80).replaceAll("\n", " ")} => ${JSON.stringify(r.value).slice(0, 1500)}\n`,
  );
  return r;
};

await ev(
  `string.Join("\\n", UnityEngine.Object.FindObjectsOfType<Ardenfall.PolarisTerrainChunk>().Take(2).SelectMany(c => c.GetComponentsInChildren<UnityEngine.MeshRenderer>(true)).Select(r => r.name + " | " + string.Join(",", r.sharedMaterials.Where(m => m != null).Select(m => m.shader.name)) + " | size=" + r.bounds.size + " | layer=" + UnityEngine.LayerMask.LayerToName(r.gameObject.layer) + " | rlm=" + r.renderingLayerMask + " | lm=" + r.lightmapIndex + " | en=" + r.enabled + " | scene=" + r.gameObject.scene.name))`,
);
await ev(`UnityEngine.LayerMask.NameToLayer("NoInteriorLight")`);
await ev(
  `string.Join(",", System.Linq.Enumerable.Range(0, 32).Select(i => i + "=" + UnityEngine.LayerMask.LayerToName(i)))`,
);

await session.close();
