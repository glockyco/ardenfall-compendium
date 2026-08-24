import type { SnapshotManifest } from "./types";

export const PUBLISHED_PRODUCT_NAME = "Ardenfall Demo 2025";

export function assertPublishableSnapshotIdentity(
  manifest: Pick<SnapshotManifest, "productName" | "buildProfile">,
): void {
  if (!manifest.productName || !manifest.buildProfile) {
    throw new Error(
      "publication identity is unproven: snapshot manifest requires productName and buildProfile",
    );
  }
  if (manifest.productName !== PUBLISHED_PRODUCT_NAME) {
    throw new Error(
      `publication embargo: expected Unity product name "${PUBLISHED_PRODUCT_NAME}", ` +
        `but snapshot reports "${manifest.productName}" (build profile "${manifest.buildProfile}")`,
    );
  }
}
