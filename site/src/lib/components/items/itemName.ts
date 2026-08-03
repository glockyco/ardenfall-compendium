export interface ItemNameRow {
  name: string | null;
  variantLabel: string;
  shortId: string;
}

export function isPlaceholderItemName(name: string | null): boolean {
  if (!name) return false;
  return /\{[^}]+\}/.test(name) || /^(?:BASE\b|PLACEHOLDER\b)/i.test(name.trim());
}

export function itemNameForDisplay(name: string | null): string {
  const trimmedName = name?.trim();
  if (!trimmedName || isPlaceholderItemName(name)) return "Unnamed item";
  return name ?? trimmedName;
}

export function itemNameForList(row: ItemNameRow, duplicateNames: Record<string, number>): string {
  const displayName = itemNameForDisplay(row.name);
  const needsDisambiguator =
    !row.name?.trim() || isPlaceholderItemName(row.name) || (duplicateNames[row.name] ?? 0) > 1;
  return needsDisambiguator ? `${displayName} — ${row.variantLabel}` : displayName;
}
