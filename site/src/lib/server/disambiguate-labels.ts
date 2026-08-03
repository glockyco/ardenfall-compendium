/**
 * Make repeated labels distinguishable inside one list.
 *
 * Two entities can carry the same authored name. A reader then meets two links with identical
 * text pointing at different pages, which WCAG 2.4.4 does not allow, so a repeated label gains
 * the short id that tells the two apart. A unique label is left alone.
 *
 * The pipeline does the same for relationship sections and item effects with its own helper. Both
 * sides need it, because a listing is built from a table the pipeline never groups.
 */
export function disambiguateLabels<K extends string, T extends Record<K, string>>(
  rows: readonly T[],
  labelKey: K,
  shortIdOf: (row: T) => string,
): T[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row[labelKey], (counts.get(row[labelKey]) ?? 0) + 1);
  return rows.map((row) => {
    const shortId = shortIdOf(row);
    if ((counts.get(row[labelKey]) ?? 0) < 2 || shortId === "") return row;
    return { ...row, [labelKey]: `${row[labelKey]} · ${shortId}` };
  });
}
