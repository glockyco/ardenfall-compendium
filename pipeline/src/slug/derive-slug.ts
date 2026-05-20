export function kebab(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

export function deriveShortId(assetId: string): string {
  const head = assetId.split(".", 1)[0] ?? "";
  if (head.length < 8 || !/^[0-9a-fA-F]+$/.test(head.slice(0, 8))) {
    throw new Error(
      `cannot derive short_id from asset id '${assetId}': need 8 hex characters before any '.' suffix`,
    );
  }
  return head.slice(0, 8).toLowerCase();
}

export interface DeriveSlugInput {
  displayName: string;
  assetId: string;
}

export function deriveSlug(input: DeriveSlugInput): string {
  const head = kebab(input.displayName) || "entity";
  return `${head}--${deriveShortId(input.assetId)}`;
}
