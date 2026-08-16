export interface ExportEvidence {
  counts: Record<string, number>;
  filteredRuntimeCreatedCount: number;
  hashes: Record<string, string>;
  timings?: unknown;
}

/**
 * Confirms that two exports from one loaded session contain the same data.
 *
 * Timing records are operational measurements and are not part of the data identity.
 */
export function assertReproducibleExports(first: ExportEvidence, second: ExportEvidence): void {
  if (!recordsEqual(first.counts, second.counts)) {
    throw new Error(
      `Reproducibility check failed: family counts differ (${formatRecord(first.counts)} versus ${formatRecord(second.counts)}).`,
    );
  }

  if (first.filteredRuntimeCreatedCount !== second.filteredRuntimeCreatedCount) {
    throw new Error(
      `Reproducibility check failed: filtered runtime-created count differs (${first.filteredRuntimeCreatedCount} versus ${second.filteredRuntimeCreatedCount}).`,
    );
  }

  if (!recordsEqual(first.hashes, second.hashes)) {
    throw new Error(
      `Reproducibility check failed: artifact hashes differ (${formatRecord(first.hashes)} versus ${formatRecord(second.hashes)}).`,
    );
  }
}

function recordsEqual(first: Record<string, unknown>, second: Record<string, unknown>): boolean {
  const firstKeys = Object.keys(first).sort();
  const secondKeys = Object.keys(second).sort();
  if (firstKeys.length !== secondKeys.length) return false;
  return firstKeys.every((key, index) => key === secondKeys[index] && first[key] === second[key]);
}

function formatRecord(record: Record<string, unknown>): string {
  return JSON.stringify(record, Object.keys(record).sort());
}
