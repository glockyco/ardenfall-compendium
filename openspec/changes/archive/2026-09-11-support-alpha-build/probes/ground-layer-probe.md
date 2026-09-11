# Ground layer probe

Question: why does a streamed cell's ground render black from the capture camera while the
player sees it lit?

Run with the world loaded: `scripts/with-env.sh bun run openspec/changes/archive/2026-09-11-support-alpha-build/probes/ground-layer-probe.ts`.

Result on 2026-09-11 against Ardenfall Alpha 0.0.10.136, centre cell `overworld_-3.-8`:

- The cell scene holds no ground mesh. The ground is 25 `Terrain`-shader `MeshRenderer`s per
  cell under a `PolarisTerrainChunk` the game spawns, and `PolarisTerrainChunk.ApplyLayer` puts
  every one of them on layer 13, `NoInteriorLight`, beside the `Ardenfall/Water` planes.
- The build's layers are: `Default, TransparentFX, Ignore Raycast, Water, UI, GrassSurface,
FirstPersonRender, Ragdoll, SkyboxRender, Post Process Volumes, NoInteriorLight, NoNavmesh,
Items, Damagable, Player, NPC, Elements, MediumObjects, SmallObjects, POLARIS RAYCAST,
See Through, Grass, Projectile, EDITOR, Navmesh`. The Demo names `postProcess`, `Item`,
  `Element` and `WeatherCollision` do not exist, so `LayerMask.GetMask` counted them as nothing.
- A plate rendered with the Demo mask shows props over the clear colour where the ground is; the
  same plate with `NoInteriorLight` included shows the ground and the water.

Positive control: the same probe lists the `Ardenfall/Water` planes on the same layer, which the
Demo mask also removed and which the player sees.
