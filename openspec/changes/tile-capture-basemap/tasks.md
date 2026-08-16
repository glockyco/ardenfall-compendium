## 1. Capture command and geometry

- [ ] 1.1 Add the controller-driven capture command and resumable run state.
- [ ] 1.2 Derive per-map bounds from world geometry rather than placed-content rows.
- [ ] 1.3 Configure an orthographic top-down camera with the settled world-to-map mapping.
- [ ] 1.4 Record the geometry checksum and fail when required geometry is missing.
- [ ] 1.5 Add capture tests for deterministic bounds, tiles, and checksum changes.

## 2. Runtime suppression and verification

- [ ] 2.1 Suppress time progression, fog, post-processing, roofs, and runtime overlays during capture.
- [ ] 2.2 Restore every changed runtime setting after success or failure.
- [ ] 2.3 Capture matching terrain with dynamic content and verify that suppression removes output differences.
- [ ] 2.4 Add a diagnostic when suppression verification detects a dynamic-content difference.

## 3. Tile pyramid and delivery

- [ ] 3.1 Render the documented static WebP pyramid and omit empty tiles.
- [ ] 3.2 Preserve geometry bounds when empty tile files are omitted.
- [ ] 3.3 Add checksum validation that rejects stale tile sets before rendering.
- [ ] 3.4 Choose tile storage after reviewing repository and external-bucket costs.
- [ ] 3.5 Choose per-space or sparse interior capture after the interior inventory is available.
- [ ] 3.6 Measure lighting seams and choose correction or accepted-seam handling.

## 4. Descriptor-driven map integration

- [ ] 4.1 Declare the basemap layer through the existing entity descriptor map contract.
- [ ] 4.2 Emit the basemap layer through `map_layers` with its tile source metadata.
- [ ] 4.3 Load the basemap through the shared map layer path without a layer-identity branch.
- [ ] 4.4 Verify marker and terrain alignment across every generated zoom level.

## 5. Pipeline reporting and release gate

- [ ] 5.1 Report map identity, geometry checksum, generated tile count, and total WebP bytes.
- [ ] 5.2 Add release validation for static tile paths, WebP content, and checksum freshness.
- [ ] 5.3 Run the capture verification against a live game export and record the suppression result.
