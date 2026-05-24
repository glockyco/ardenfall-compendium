import { describe, expect, it } from "bun:test";
import { ControlCommandError } from "../src/hotrepl-client";
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
        output:
          this.preflightCalls === 1
            ? {
                ready: false,
                checks: [
                  { name: "ardenfallGame", ok: false, reason: "ArdenfallGame.instance is null" },
                ],
              }
            : { ready: true, checks: [] },
        artifacts: {},
      };
    }
    if (name === "compendium.continueFromMenu") {
      return { status: "ok", output: { clicked: true }, artifacts: {} };
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

  it("propagates non-transient continue command failures", async () => {
    const client = new FailingContinueClient();

    await expect(waitForWorld(client, { timeoutMs: 1_000, pollIntervalMs: 0 })).rejects.toThrow(
      "fatal continue failure",
    );
    expect(client.calls.map((call) => call.name)).toEqual([
      "compendium.preflight",
      "compendium.continueFromMenu",
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
        output:
          this.continueCalls < 2
            ? {
                ready: false,
                checks: [
                  { name: "ardenfallGame", ok: false, reason: "ArdenfallGame.instance is null" },
                ],
              }
            : { ready: true, checks: [] },
        artifacts: {},
      };
    }
    if (name === "compendium.continueFromMenu") {
      this.continueCalls++;
      if (this.continueCalls === 1) {
        throw new ControlCommandError({
          kind: "precondition_failed",
          code: "continueButtonMissing",
          message: "No active interactable Continue button was found.",
          retryable: false,
        });
      }
      return { status: "ok", output: { clicked: true }, artifacts: {} };
    }
    throw new Error(`unexpected call ${name}`);
  }
}

class FailingContinueClient implements WaitForWorldClient {
  readonly calls: Array<{ name: string; args: Record<string, unknown> }> = [];

  async call(name: string, args: Record<string, unknown>) {
    this.calls.push({ name, args });
    if (name === "compendium.preflight") {
      return {
        status: "ok",
        output: {
          ready: false,
          checks: [{ name: "ardenfallGame", ok: false, reason: "ArdenfallGame.instance is null" }],
        },
        artifacts: {},
      };
    }
    if (name === "compendium.continueFromMenu") {
      throw new ControlCommandError({
        kind: "validation_failed",
        code: "badUiState",
        message: "fatal continue failure",
        retryable: false,
      });
    }
    throw new Error(`unexpected call ${name}`);
  }
}
