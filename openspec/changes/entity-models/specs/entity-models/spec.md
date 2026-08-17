## Purpose

Defines the 3D models the compendium publishes, where their geometry comes from, how a model is proven to
be real before it ships, and how a page shows one without depending on scripting.

## ADDED Requirements

### Requirement: A model asset is carried like any other asset

A model MUST travel the existing asset path: a manifest row naming its entity, row and slot, a
content-addressed file, and a canonical asset row whose kind distinguishes it from an image. A model MUST
NOT be referenced by a page except through that row.

#### Scenario: A model reaches a page through an asset row

- **WHEN** an export produces a model for an entity row
- **THEN** the manifest carries a row whose kind is a model and whose source path is a glTF binary
- **AND** the canonical asset row records the entity, row, slot, kind and hash

### Requirement: Geometry is read from the mesh's own buffers, with its own layout

Extraction MUST read a vertex layout from the mesh's attribute table and decode by that layout. It MUST
NOT assume a stride, an attribute order, or a component format.

#### Scenario: Two meshes with different strides both export

- **WHEN** two meshes declare different vertex attribute layouts
- **THEN** each is decoded by its own declared layout

#### Scenario: A half-precision attribute is decoded as declared

- **WHEN** a mesh declares an attribute in half precision
- **THEN** the exporter decodes that attribute as half precision

### Requirement: A decoded mesh is verified before it is published

Extraction MUST compare a decoded mesh against the source mesh's declared bounds, and MUST reject the row
when they disagree. An empty or partial read MUST be reported as a failure and MUST NOT be published as a
model.

#### Scenario: An empty read fails rather than publishing

- **WHEN** a mesh yields no vertices
- **THEN** no model row is emitted
- **AND** a diagnostic reports the mesh and the reason

#### Scenario: A decoded mesh matching its bounds is published

- **WHEN** a decoded mesh reproduces the source mesh's declared bounds within tolerance
- **THEN** the model row is emitted

#### Scenario: Indices outside the vertex range fail

- **WHEN** a decoded index refers past the last vertex
- **THEN** no model row is emitted
- **AND** a diagnostic reports the mesh and the reason

### Requirement: Exported geometry is correct in glTF's coordinate system

A published model MUST be handed to a viewer in glTF's coordinate system, with triangle winding preserved
so faces point outward. The conversion MUST be applied consistently to positions, normals, tangents and
any node transform.

#### Scenario: A model renders with outward faces

- **WHEN** a model is rendered in a glTF viewer
- **THEN** its faces point outward
- **AND** its orientation matches the object as the game draws it

### Requirement: Worn geometry is composed by the game

A model of a character or of worn armour MUST be produced from the game's own avatar composition, so
placement, scale and skinning are the game's. Extraction MUST NOT position clothing or armour on a body
itself.

#### Scenario: Armour sits where the game puts it

- **WHEN** a model is exported for armour worn on a body
- **THEN** the geometry is taken from the composed avatar the game built

#### Scenario: A body variant is named

- **WHEN** worn geometry exists for more than one body variant
- **THEN** each exported model names the variant it was composed for

### Requirement: Every model carries a poster image

A model MUST be accompanied by a still image of the same subject. A page MUST show that image before a
viewer loads, and MUST still show it when scripting or WebGL is unavailable.

#### Scenario: A page without scripting still shows the object

- **WHEN** a page carrying a model is rendered without scripting
- **THEN** the poster image is visible

#### Scenario: A viewer replaces the poster once ready

- **WHEN** a reader activates the viewer and it loads
- **THEN** the interactive model replaces the poster

### Requirement: The viewer loads only where a model is shown

Viewer code MUST NOT enter the prerendered output or the bundles of routes that show no model. It MUST be
loaded on demand.

#### Scenario: A page with no model loads no viewer

- **WHEN** a page that carries no model is loaded
- **THEN** no viewer code is requested

### Requirement: A model records the asset and build it came from

Every model row MUST name the source mesh asset and the build it was exported from, so a published model
is traceable to its origin.

#### Scenario: A model names its source

- **WHEN** a model row is exported
- **THEN** it records the source mesh asset name and the build identity

### Requirement: A model surface carries the attribution its permission requires

Where the permission to publish geometry requires a notice, a page showing a model MUST display that notice
in wording the permission specifies. The notice MUST be data rather than markup repeated per page, so one
edit changes every surface.

#### Scenario: A model page shows its required notice

- **WHEN** a page renders a model and the recorded permission requires a notice
- **THEN** the page displays that notice

#### Scenario: The notice is not restated per page

- **WHEN** the required notice changes
- **THEN** one change updates every page that shows a model

### Requirement: Model coverage is reported

The run manifest MUST report, per entity family, how many rows carry a model, how many models were
recovered from meshes the runtime marks unreadable, and how many candidate rows failed verification. A
build that changes its geometry MUST make that shift visible without a database query.

#### Scenario: An export reports model coverage

- **WHEN** an export completes
- **THEN** its manifest reports models exported, recovered and failed per entity family
