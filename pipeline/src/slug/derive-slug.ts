export function kebab(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

/**
 * Derives a short id from a lookup-asset id (`<8hex>[.suffix]`), a record id
 * (`<table>;<subtable>;<recordId>`, where `recordId` is 32 hex characters), or
 * a named-asset id (`named;<entityId>;<assetName>`), whose asset name is
 * kebab-cased.
 */
export function deriveShortId(id: string): string {
  if (id.startsWith("named;")) {
    const parts = id.split(";");
    const entityId = parts[1];
    const assetName = parts[2];
    const shortId = assetName === undefined ? "" : kebab(assetName);
    if (
      parts.length === 3 &&
      entityId !== undefined &&
      /^[a-z][a-z0-9-]*$/.test(entityId) &&
      assetName !== undefined &&
      assetName !== "" &&
      shortId !== ""
    ) {
      return shortId;
    }
  } else if (id.includes(";")) {
    const parts = id.split(";");
    const recordId = parts.length === 3 ? parts[2] : undefined;
    if (
      parts.length === 3 &&
      parts[0] !== "" &&
      parts[1] !== "" &&
      recordId !== undefined &&
      /^[0-9a-fA-F]{32}$/.test(recordId)
    ) {
      return recordId.slice(0, 8).toLowerCase();
    }
  } else {
    const head = id.split(".", 1)[0] ?? "";
    if (head.length >= 8 && /^[0-9a-fA-F]+$/.test(head.slice(0, 8))) {
      return head.slice(0, 8).toLowerCase();
    }
  }

  throw new Error(
    `cannot derive short_id from id '${id}': need lookup-asset id '<8hex>[.suffix]', record id '<table>;<subtable>;<recordId>' where recordId is 32 hex characters, or named-asset id 'named;<entityId>;<assetName>'`,
  );
}

export interface DeriveSlugInput {
  displayName: string;
  assetId: string;
}

export function deriveSlug(input: DeriveSlugInput): string {
  const head = kebab(input.displayName) || "entity";
  return `${head}--${deriveShortId(input.assetId)}`;
}
