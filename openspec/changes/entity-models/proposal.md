## Why

The compendium publishes an item's numbers, its prose and its provenance, and a 100-pixel icon. The
object itself, the thing a reader recognises, is never shown. The geometry is right there in the build.

Read-only probes of Ardenfall Demo `0.0.10.91`, Unity `2022.3.61f1`, measured what is reachable. Numbers
come from `spikes/model-survey.json`; the probes are `spikes/model-feasibility.cs`, `model-access.cs`,
`model-readability-census.cs`, `model-geometry-detail.cs` and `model-decode-proof.cs`.

- 986 of 1,273 item definitions carry a pickup prefab, and those resolve to only **176 unique meshes**,
  because a mesh is shared across a family. The inventory prefab is authored 6 times and is not the
  geometry to use.
- Mesh readability splits along one line, and the cause is the game's own need. Avatar assets ship
  Read/Write enabled because `CombineSkinnedMeshUtility.CombineSkinnedMesh` does CPU mesh combining on
  them: 528 readable meshes, including `av_clothing` 98, `av_hair` 56, **`av_armor` 48** and
  `av_humanoid` 44. World and item meshes are only ever drawn, so 765 are unreadable, including
  `msh_item` 176 and `msh_arch` 218.
- An unreadable mesh is still recoverable. `Mesh.GetVertexBuffer` and `Mesh.GetIndexBuffer` return real
  data, and `Mesh.GetVertexAttributes` returns the layout needed to decode it. Positions decoded from the
  raw buffer of `msh_item_drops_istaru_egg` reproduced the mesh's own declared bounds to six decimal
  places, with every index inside the vertex range.
- Reading `Mesh.vertices` on an unreadable mesh returns an **empty array rather than throwing**, so a
  naive exporter would publish empty models and report success. That is the trap this change must close.
- An armour mesh carries a complete skin: `av_armor_silvanite_chest_MALE.000` has 12,844 vertices, 6,416
  triangles, full UVs and normals, 12,844 bone weights and 68 bind poses.
- The game composes armour onto a body itself, in `CharacterAvatar`, through `attachedSkinnedMeshes` and
  `attachedClothing` built from `IAvatarClothingItem.GetClothingAsset()` and rebound to a shared
  `rootbone`. It also ships `ArmorMannequin`, a posed display stand. A live export inherits correct
  placement instead of reinventing it.
- Materials are four custom shaders, led by `Ardenfall/Simple Diffuse` at 260 uses, over small
  GPU-compressed textures at 512x512 and below. The existing `SpriteAssetExporter` already reads
  GPU-compressed textures by blitting and reading pixels back.

Prior art says the shape of the answer. Wowhead streams about 61 KB of model and texture data per item
behind one viewer of 247 KB gzipped, and Fanbyte's FFXIV model viewer does the same with Three.js. Neither
publishes glTF; both ship the game's own formats plus a bespoke loader. We do not need that, because
glTF 2.0 is the interchange format and `meshopt` compression costs an 8.0 KiB gzipped decoder against
Draco's 246 KiB, and beat Draco 410 KB to 1.99 MB on Khronos' own BrainStem sample.

## What Changes

- Add a model asset kind to the export path, beside the existing image kind, carrying glTF 2.0 binary.
- Export static geometry for item meshes by decoding the mesh's own vertex and index buffers, with the
  layout read from the mesh's attribute table rather than assumed.
- Verify every decoded mesh against the mesh's declared bounds, and fail the row when they disagree, so an
  empty read can never be published as a model.
- Export composed avatar geometry for characters and worn armour using the game's own avatar composition,
  so armour sits where the game puts it.
- Emit a poster image for every model, from the same capture, so a page shows the object before any
  WebGL runs and still shows it when scripting is unavailable.
- Render models on entity pages through a viewer loaded only where it is used, in the same manner as the
  map route loads deck.gl.
- Report per-entity coverage: models exported, meshes recovered from unreadable assets, and rows that
  failed verification.

**BREAKING** for nothing published today. The asset manifest's `kind` enum and `sourcePath` pattern widen,
which is additive.

## Capabilities

### New Capabilities

- `entity-models`: the model asset kind, the geometry sources and their verification, avatar composition,
  poster images, coverage reporting, and the presentation contract for a model surface.

### Modified Capabilities

None yet. `canonical-data` governs artifacts and staging and already carries asset rows; this change adds
a kind rather than changing the contract.

## Impact

- `schemas/asset-manifest.schema.json`: `kind` gains `model`; `sourcePath` accepts `.glb` beside `.png`.
- `pipeline/src/types.ts`: `SnapshotAssetEntry.kind` and `EmittedAssetRef.assetKind` become unions rather
  than the literal `"image"`.
- `pipeline/src/stages/emit-assets.ts`: currently asserts a `.png` path and converts through `sharp`; it
  gains a model branch. `asset_refs` already carries `asset_kind`, so no DDL change.
- `mod/src/Assets/`: a mesh exporter and a GLB writer beside `SpriteAssetExporter`.
- `site/src/lib/components/`: a model surface and a lazily loaded viewer.
- `fixtures/synthetic/snapshot`: a static model, a composed avatar model, a model whose verification
  fails, and an entity with no model.
- Deploy budget: 176 item meshes and 48 armour meshes are the whole population, so this adds hundreds of
  files, not thousands. `site/scripts/build-pagefind.ts` already enforces the 20,000-file limit.
- The Alpha build is unmeasured. Every count above describes the Demo.

## Open Questions

- **Rights, and this one blocks implementation.** Publishing extracted geometry is a different act from
  publishing measurements. Neither Wowhead nor Fanbyte documents a rights position, and the one explicit
  publisher policy found, Blizzard's legal FAQ, grants only personal non-commercial display and forbids
  decompilation. Ardenfall is a demo-stage game by Spellcast Studios, so the cheap and durable answer is
  the developer's written permission. Until that exists, this change stays planned.
- Whether a reader may download a model file, or only view it. The conservative default is view only.
- How many avatar variants a body needs. Armour is authored per gender, as `_MALE` and `_FEMALE` suffixes
  show, and races carry their own forms, so the variant count must be measured before avatars are built.
