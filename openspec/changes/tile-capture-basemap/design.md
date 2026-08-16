## Context

The current map draws markers over a blank canvas. The game's authored map texture does not provide a reliable terrain basemap.

Terrain capture must use the game world as its source. Terrain bounds can exceed the extent of placed content. Bounds therefore come from world geometry.

The capture runs in game space and writes a static tile pyramid. The map already loads layers from descriptor metadata and the `map_layers` read model.

## Goals and non-goals

**Goals:**

- Capture terrain reproducibly for each map.
- Bind every tile set to the geometry used for its capture.
- Remove runtime overlays from capture output.
- Serve static WebP tiles through the existing map layer contract.
- Report tile counts and total bytes.

**Non-goals:**

- Replacing the descriptor-owned map layer contract.
- Adding a second world-to-map transform in the site.
- Capturing runtime characters or other transient state.

## Decisions

### 1. Capture uses orthographic top-down rendering

The controller-driven command captures each map from an orthographic top-down camera. It derives bounds from world geometry rather than placed content.

The capture suppresses time progression, fog, post-processing, roofs, characters, particles, canvases, nameplates, damage numbers, and world-space text before rendering.

A matching-terrain comparison with dynamic content present verifies that suppression works. The capture restores runtime state after the comparison.

### 2. Capture makes the coordinate mapping ours by construction

`pipeline/src/entities/location/canonicaliser.ts` maps world x to map x, world z to map y, and world y to elevation. It applies no sign flip. The game uses the same orientation.

The capture uses that mapping as its construction rule. The tile plate therefore does not depend on a later interpretation of game UI coordinates.

### 3. Geometry checksums guard freshness

Each run records a checksum of the geometry used to render its tiles. The map compares that checksum with current geometry before rendering. A mismatch fails the load instead of displaying stale terrain.

### 4. Static WebP delivery keeps the runtime simple

The pyramid uses `/tiles/{map}/{z}/{x}/{y}.webp`. Empty tiles are omitted, while geometry bounds remain authoritative. The pipeline reports tile count and total bytes for each map and checksum.

### 5. Open decision: tile storage

The tiles can live in an external bucket such as Cloudflare R2 behind a custom domain. They can also live in the repository beside the static site assets.

External storage avoids repeated repository rewrites as terrain changes. Repository storage keeps versioning and deployment in one place. The choice must happen before the first full run because moving tiles changes every URL.

### 6. Open decision: interior capture shape

Interiors can be captured per interior space. They can also share a coordinate range and use sparse tiles for occupied spaces.

Per-space capture avoids empty ranges and isolates updates. Shared sparse capture preserves one coordinate range but may create more index and cache work. The choice depends on the first complete interior inventory.

### 7. Open decision: lighting seams

The first capture can measure seams and then receive a lighting correction. The first release can also accept visible seams until a lighting correction exists.

A correction may require game-side lighting changes or post-capture processing. Accepting seams keeps the first capture available but leaves a visible quality defect.

## Risks and trade-offs

- Geometry changes invalidate the checksum and require a new capture.
- Suppression can miss a new overlay type unless the verification comparison detects it.
- Sparse interior tiles reduce files but make spatial indexing less obvious.
- Static assets avoid a tile server but require deployment capacity for every published tile.
