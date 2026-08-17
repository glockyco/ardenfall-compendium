## Context

See `proposal.md` - Why for the measurements. Decompiled paths are relative to
`.decompiled/steam-22145060-63c576261184/csharp/`.

- `Ardenfall/Item/ItemData.cs:25-33` declares `pickupMeshList`, `inventoryVisualMesh`,
  `inventoryVisualContainer`, `icon` and `quickslotIcon`, all as `Parameter<T>`, so a mesh reference is
  inherited through the prototype chain this repository already models. `GetPickupPrefab()` and
  `GetInventoryPrefab()` resolve them.
- `Ardenfall/Avatar/CharacterAvatar.cs` and `AvatarComponent.cs` compose an avatar:
  `attachedSkinnedMeshes`, `attachedClothing` from `IAvatarClothingItem.GetClothingAsset()`, a shared
  `rootbone`, and `CombineSkinnedMeshUtility.CombineSkinnedMesh` for combining.
- `Ardenfall/ArmorMannequin.cs` builds an avatar on a stand and exposes a pose parameter, so the game
  already has a display concept for worn armour.
- `mod/src/Assets/SpriteAssetExporter.cs` already reads a GPU-compressed texture by blitting into a
  `RenderTexture` and reading pixels back, hashes the result, and writes it into a staging directory.
- `schemas/asset-manifest.schema.json` constrains `kind` to `image` and `sourcePath` to
  `^assets/[^\0]+\.png$`. `pipeline/src/stages/emit-assets.ts` asserts that path and converts through
  `sharp`. `asset_refs` in `pipeline/src/sql/site-metadata-ddl.ts` already carries `asset_kind`.

## Goals / Non-Goals

**Goals:**

- Publish item geometry and composed avatar geometry as glTF binary, verified against the source mesh.
- Keep a model on the existing asset path, so provenance, staging and hashing stay in one mechanism.
- Show the object on a page without depending on WebGL or scripting.

**Non-Goals:**

- No animation. `SkinnedMeshRenderer.BakeMesh` snapshots a pose and discards joints, and UnityGLTF's
  animation export is Editor-only, so clips need their own change with its own evidence.
- No world or architecture geometry. `msh_arch` and `msh_env` are 354 meshes serving no entity page.
- No offline asset ripping. AssetRipper's `GlbModelExporter` would work on the shipped files and sidesteps
  runtime flags, but the in-game route is proven, reuses this repository's existing export path, and needs
  no second toolchain. Recorded as the fallback if a future build strips buffer access.
- No model downloads until the rights question is answered.
- No material authoring. A published material carries the base colour texture and factors the game's
  shaders expose, not a re-creation of those shaders.

## Decisions

### Read geometry from the buffers, and prove it against the bounds

An unreadable mesh still has a vertex buffer and an index buffer, and `Mesh.GetVertexAttributes` describes
the layout. A probe decoded `msh_item_drops_istaru_egg` and reproduced its declared bounds exactly, with a
computed stride of 52 matching the actual stride, so the layout reading is correct rather than lucky.

The verification is not ceremony. `Mesh.vertices` on an unreadable mesh returns an **empty array and does
not throw**, so the failure mode of this whole change is silently publishing empty models while reporting
success. Comparing the decoded bounds against the mesh's own declared bounds catches exactly that, and the
mesh carries the expected answer for free.

Alternative considered: enabling Read/Write by patching asset loading. Rejected because it changes the
game's memory behaviour to obtain data the game already exposes.

Alternative considered: `BakeMesh` for items, by hosting a static mesh on a skinned renderer. Rejected
because the buffer route is exact and direct, while that route bends a skinning API to a non-skinning
purpose.

### Compose avatars with the game's own avatar, not our own placement

Armour is authored per body, as `av_armor_silvanite_chest_MALE.000` shows, and the game binds it to a
shared skeleton and combines it. Reproducing that placement would be a second producer of the same fact,
and would drift. So an avatar model comes from a composed avatar, and `ArmorMannequin` supplies the pose.

The variant count is unmeasured and must be measured before implementation: armour carries gender
suffixes, and `CharacterRace` carries an `avatarForm`, so the product of races and genders decides how many
models one armour piece needs. A task measures it and records the number before any avatar is exported.

### Bake the pose rather than ship a skeleton, for now

A posed static mesh is what a reader wants to look at, and `BakeMesh` produces one from the composed
avatar. Shipping joints, weights and bind poses would be a larger contract whose only consumer would be
animation, which is out of scope. Armour meshes do carry full skin data, measured at 12,844 bone weights
and 68 bind poses, so nothing is lost permanently by deferring.

### Widen the asset kind rather than add a second asset path

The manifest, the hashing, the staging and the release provenance all already work, and `asset_refs`
already has an `asset_kind` column. Widening the manifest enum and the source-path pattern is the smaller
change and keeps one producer for asset provenance. The pipeline's model branch must not run a model
through `sharp`.

### Poster first, viewer on demand

Every model gets a still image from the same capture. That is not a fallback bolted on: the poster is what
a prerendered page shows, what a reader without WebGL sees, and what a link preview uses.

The poster must be a real element in the prerendered HTML, not the viewer's own `poster` attribute. That
attribute is managed by the element at runtime, so it renders nothing until the custom element upgrades,
which is precisely the case the fallback exists for. Satisfying the requirement with the attribute alone
would leave a page blank for the reader it was written to serve. Warframe's wiki
publishes stills only, at 512x512 under an explicit media policy, which is evidence that stills carry most
of the value on their own.

The viewer then loads on demand, exactly as the map route loads deck.gl. That is a constraint rather than a
preference: `@google/model-viewer` calls `customElements.define` at module top level, so a static import
fails during a Node prerender, where `customElements` does not exist. Three.js imports cleanly and guards
its `navigator` use, but its renderer still needs a browser canvas at construction. Either way the element
is created after mount, and the prerendered page holds the poster.

Measured costs decide the library: `@google/model-viewer@4.3.1` is 294,739 bytes gzipped and brings `alt` text, a keyboard
interaction prompt and a poster mechanism; `three@0.183.0` alone is 127,631 bytes gzipped with no
accessibility affordances of its own. Compression is `meshopt` at an 8,233-byte gzipped decoder, against
Draco's 252,345 bytes across three files. On Khronos' own BrainStem sample, a third-party asset rather than
one of ours, the meshopt encoding is 409,991 bytes against Draco's 1,989,369. Our own per-model sizes are
unmeasured until an export exists, so the decoder cost is the part of this decision that rests on measured
numbers.

Alternative considered: Threlte. Rejected for this surface because one lazily loaded element needs no
scene-graph framework, and this change adds no scene to manage. Not rejected for prerender safety: its
`Canvas` gates the renderer behind a bound canvas, so it renders markup on the server and creates WebGL on
the client.

### Expect permission to arrive with conditions, and carry them as data

The one surveyed policy that grants anything, Jagex's Fan Content Policy v1.3, permits 3D content derived
from game models for personal use and pairs the grant with a mandated attribution notice in specified
wording, while still forbidding decompilation and direct lifts with no creative input. It therefore does not
authorise a published viewer, but it does show the shape a permission takes.

So the permission this change waits on is likely to carry conditions, and a condition that must appear on a
page is content, not markup. Recording the notice as data keeps one producer for it and lets a later
revision change every surface at once, which also matters because such a grant is revocable.

### Reading a reader's own install is the answer to a refusal, not to this change

RuneApps' RuneScape model viewer ships a 680 KB gzipped bundle and no game assets at all: a reader drops a
local game cache into the page, and the browser reads it. That architecture redistributes nothing, so it
survives a refused permission, and it is the reason the rights question has an answer other than
abandonment.

It is not the recommendation here, for three measured reasons. It would need a browser-side reader for
Unity's `data.unity3d` container, which is a second extraction toolchain beside the mod that already works.
It would contradict this repository's rule that the site renders pipeline-emitted read models and does not
parse game data. And it would show a model only to a reader who owns and locates the game files, so the
compendium's pages would stay empty for everyone else. Recorded so a refusal has a designed path rather
than an improvised one.

## Risks / Trade-offs

- [Rights] → The proposal's blocking open question. Nothing ships before the developer's written
  permission, and the conservative default is view-only with no download.
- [An empty read publishes an empty model] → The bounds check is a requirement, and a fixture carries a
  mesh that fails it.
- [A future build strips buffer access] → The failure is loud, because verification fails rather than
  emitting an empty model, and AssetRipper remains the recorded fallback.
- [Custom shaders will not map cleanly to glTF PBR] → Publish the base colour texture and the factors the
  shader exposes, and accept that a published model looks flatter than the game. Do not invent a material.
- [Avatar variants could multiply] → Measure the variant count before implementing, and record it.
- [Viewer weight on a data-dense page] → Load on demand only, and keep the poster as the default state.

## Migration Plan

1. Widen the manifest schema, the pipeline types, and the asset stage, with the image path unchanged.
2. Add the GLB writer and the buffer decoder in the mod, with the bounds verification and its tests.
3. Export item models and posters; measure coverage against the 176 unique meshes.
4. Measure the avatar variant count, record it, then compose and export avatar models.
5. Add the model surface and the on-demand viewer; verify a page in a browser against a live export.
6. Add fixtures, including a model that fails verification, then run the repository gate.

Rollback drops the model rows, the model files and the surface; the image path is untouched throughout.

## Open Questions

- The rights position, which gates everything.
- Whether a reader may download a model file.
- The avatar variant count, and whether every armour piece needs every body.
