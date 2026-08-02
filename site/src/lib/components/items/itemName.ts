export function isPlaceholderItemName(name: string | null): boolean {
  if (!name) return false;
  return /\{[^}]+\}/.test(name) || /^(?:BASE\b|PLACEHOLDER\b)/i.test(name.trim());
}

export function itemNameForDisplay(name: string | null): string {
  return name && !isPlaceholderItemName(name) ? name : "Name unavailable";
}
