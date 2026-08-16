## Why

The current map draws markers over a blank canvas, so placed content lacks terrain context. A live HotRepl probe against Ardenfall Demo `0.0.10.91` found that the authored game map texture cannot provide a terrain basemap. The capture must make the world-to-map mapping ours by construction. The release manifest `pipeline/artifacts/releases/0.0.10.91-20260815-2245519526240/artifact-manifest.json` records the existing static WebP asset delivery path.

## What Changes

- Add a controller-driven mod command that captures each map with an orthographic, top-down camera.
- Derive capture bounds from world geometry for each map.
- Suppress time progression, fog, post-processing, roofs, characters, particles, canvases, nameplates, damage numbers, and world-space text before rendering.
- Record a checksum that binds each tile set to the geometry used for its capture.
- Generate a static WebP tile pyramid at `/tiles/{map}/{z}/{x}/{y}.webp`.
- Skip empty tiles while preserving the geometry bounds.
- Integrate the basemap through the existing descriptor-driven map layer and `map_layers` data path.
- Keep map components independent of layer identity.
- Verify suppression by capturing matching terrain with dynamic content present and comparing the outputs.
- Report generated tile counts and total bytes through the pipeline.

The following decisions remain open:

- Store tiles in an external bucket such as Cloudflare R2, or commit them to the repository.
- Capture interiors per interior space, or capture their shared coordinate range as sparse tiles.
- Resolve lighting seams after the first capture, or accept seams until a lighting correction exists.

## Capabilities

### New Capabilities

- `tile-capture-basemap`: reproducible terrain capture, static WebP tiles, geometry checksums, and descriptor-driven basemap rendering.
