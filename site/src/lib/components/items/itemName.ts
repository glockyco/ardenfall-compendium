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
  return name && !isPlaceholderItemName(name) ? name : "Name unavailable";
}

export function itemNameForList(row: ItemNameRow, duplicateNames: Record<string, number>): string {
  const displayName = itemNameForDisplay(row.name);
  const needsDisambiguator =
    !row.name || isPlaceholderItemName(row.name) || (duplicateNames[row.name] ?? 0) > 1;
  return needsDisambiguator ? `${displayName} — ${row.variantLabel} · ${row.shortId}` : displayName;
}
