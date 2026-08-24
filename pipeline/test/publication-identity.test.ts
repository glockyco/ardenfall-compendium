import { describe, expect, it } from "bun:test";
import {
  assertPublishableSnapshotIdentity,
  PUBLISHED_PRODUCT_NAME,
} from "../src/publication-identity";

describe("publication identity", () => {
  it("accepts a proven Demo snapshot", () => {
    expect(() =>
      assertPublishableSnapshotIdentity({
        productName: PUBLISHED_PRODUCT_NAME,
        buildProfile: "release",
      }),
    ).not.toThrow();
  });

  it("rejects a snapshot from another installed game", () => {
    expect(() =>
      assertPublishableSnapshotIdentity({ productName: "Vespera", buildProfile: "development" }),
    ).toThrow(/publication embargo.*Vespera.*development/);
  });

  it("rejects a legacy snapshot without proven identity", () => {
    expect(() => assertPublishableSnapshotIdentity({ productName: "", buildProfile: "" })).toThrow(
      /identity is unproven/,
    );
  });
});
