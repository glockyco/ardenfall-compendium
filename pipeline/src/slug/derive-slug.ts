import { createHash } from "node:crypto";

export function kebab(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

/**
 * Derives a short id from a lookup-asset id (`<8hex>[.suffix]`), a record id
 * (`<table>;<subtable>;<recordId>`, where `recordId` is a GUID written as 32 hex
 * characters with or without hyphens), or a named-asset id
 * (`named;<entityId>;<assetName>`), whose full id is hashed. The asset name is
 * validated but never used as a public URL identifier.
 *
 * The game authors both hyphenated and bare record GUIDs. Portal records use the
 * bare form and NPC records use the hyphenated form. Hyphens are removed before
 * the short id is taken, so one GUID gives one short id in either form.
 */
export function deriveShortId(id: string): string {
  if (id.startsWith("named;")) {
    const parts = id.split(";");
    const entityId = parts[1];
    const assetName = parts[2];
    if (
      parts.length === 3 &&
      entityId !== undefined &&
      /^[a-z][a-z0-9-]*$/.test(entityId) &&
      assetName !== undefined &&
      assetName !== "" &&
      kebab(assetName) !== ""
    ) {
      // Hash the full entity id, not the designer's asset name, so public URLs
      // stay opaque and stable when a display name or authoring label changes.
      return createHash("sha256").update(id).digest("hex").slice(0, 8);
    }
  } else if (id.includes(";")) {
    const parts = id.split(";");
    const recordId = parts.length === 3 ? parts[2]?.replaceAll("-", "") : undefined;
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
    `cannot derive short_id from id '${id}': need lookup-asset id '<8hex>[.suffix]', record id '<table>;<subtable>;<recordId>' where recordId is a 32-character hex GUID with or without hyphens, or named-asset id 'named;<entityId>;<assetName>'`,
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
