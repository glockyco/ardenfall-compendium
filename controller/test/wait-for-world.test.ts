import { describe, expect, it } from "bun:test";
import { waitForWorld, type WaitForWorldClient } from "../src/wait-for-world";

class FakeWorldClient implements WaitForWorldClient {
  readonly calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  private preflightCalls = 0;

  async call(name: string, args: Record<string, unknown>) {
    this.calls.push({ name, args });
    if (name === "compendium.preflight") {
      this.preflightCalls++;
      return {
        status: "ok",
        result:
          this.preflightCalls === 1
            ? {
                ready: false,
                checks: [
                  { name: "ardenfallGame", ok: false, reason: "ArdenfallGame.instance is null" },
                ],
              }
            : { ready: true, checks: [] },
        artifacts: [],
        diagnostics: [],
      };
    }
    if (name === "compendium.continueFromMenu") {
      return { status: "ok", result: { clicked: true }, artifacts: [], diagnostics: [] };
    }
    throw new Error(`unexpected call ${name}`);
  }
}

describe("waitForWorld", () => {
  it("clicks continue from menu and polls until preflight is ready", async () => {
    const client = new FakeWorldClient();

    await waitForWorld(client, { timeoutMs: 1_000, pollIntervalMs: 0 });

    expect(client.calls.map((call) => call.name)).toEqual([
      "compendium.preflight",
      "compendium.continueFromMenu",
      "compendium.preflight",
    ]);
  });
});
