import type { CommandResult } from "./hotrepl-client";

export interface WaitForWorldClient {
  call(name: string, args: Record<string, unknown>): Promise<CommandResult>;
}

export interface WaitForWorldOptions {
  timeoutMs: number;
  pollIntervalMs?: number;
}

export async function waitForWorld(
  client: WaitForWorldClient,
  options: WaitForWorldOptions,
): Promise<void> {
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  const deadline = Date.now() + options.timeoutMs;
  let lastReason: string;

  const first = await client.call("compendium.preflight", {});
  if (first.result.ready === true) return;
  lastReason = formatPreflightFailure(first.result);

  await client.call("compendium.continueFromMenu", {});

  for (;;) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for world: ${lastReason}`);
    if (pollIntervalMs > 0) await Bun.sleep(pollIntervalMs);
    const preflight = await client.call("compendium.preflight", {});
    if (preflight.result.ready === true) return;
    lastReason = formatPreflightFailure(preflight.result);
  }
}

function formatPreflightFailure(result: Record<string, unknown>): string {
  const checks = Array.isArray(result.checks) ? result.checks : [];
  const failedChecks = checks
    .filter((check): check is Record<string, unknown> => isObject(check) && check.ok !== true)
    .map((check) => {
      const name = typeof check.name === "string" && check.name.length > 0 ? check.name : "unknown";
      const reason =
        typeof check.reason === "string" && check.reason.length > 0 ? check.reason : "failed";
      return `${name}: ${reason}`;
    });

  if (failedChecks.length === 0) return "compendium.preflight is not ready";
  return failedChecks.join("; ");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
