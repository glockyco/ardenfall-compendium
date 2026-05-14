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

  it("retries continue command until the menu button exists", async () => {
    const client = new RetryContinueClient();

    await waitForWorld(client, { timeoutMs: 1_000, pollIntervalMs: 0 });

    expect(client.calls.map((call) => call.name)).toEqual([
      "compendium.preflight",
      "compendium.continueFromMenu",
      "compendium.preflight",
      "compendium.continueFromMenu",
      "compendium.preflight",
    ]);
  });
});

class RetryContinueClient implements WaitForWorldClient {
  readonly calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  private continueCalls = 0;

  async call(name: string, args: Record<string, unknown>) {
    this.calls.push({ name, args });
    if (name === "compendium.preflight") {
      return {
        status: "ok",
        result:
          this.continueCalls < 2
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
      this.continueCalls++;
      return this.continueCalls === 1
        ? {
            status: "ok",
            result: {},
            artifacts: [],
            diagnostics: [
              {
                kind: "precondition_failed",
                code: "continueButtonMissing",
                message: "No active interactable Continue button was found.",
                retryable: false,
              },
            ],
          }
        : { status: "ok", result: { clicked: true }, artifacts: [], diagnostics: [] };
    }
    throw new Error(`unexpected call ${name}`);
  }
}
