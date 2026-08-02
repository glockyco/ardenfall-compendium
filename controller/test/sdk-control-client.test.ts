import { describe, expect, it } from "bun:test";
import { connect, HotReplError, type RuntimeRequest, type RuntimeTransport } from "@hotrepl/sdk";
import type { ArtifactRef, HandshakeMessage, ServerMessage } from "@hotrepl/protocol";
import { ControlCommandError } from "../src/control-types";
import { SdkControllerClient } from "../src/sdk-control-client";

const artifactRef: ArtifactRef = {
  uri: "file:///tmp/manifest.json",
  path: "/tmp/manifest.json",
  contentType: "application/json",
  byteSize: 2,
  sha256: "abc",
  finalized: true,
};

class FakeRuntimeTransport implements RuntimeTransport {
  readonly requests: RuntimeRequest[] = [];
  closed = false;
  hangCommandsList = false;

  async handshake(): Promise<HandshakeMessage> {
    return {
      type: "handshake",
      protocolVersion: 2,
      host: { name: "fake", version: "1", platform: "test" },
      evaluator: {
        name: "fake-csharp",
        languageVersion: "12",
        persistentState: true,
        supportsCompletion: true,
        cancellation: "cooperative",
      },
      availableEvaluators: ["csharp"],
      defaultUsings: [],
      helpers: [],
      control: { supported: true, commandsListChanged: true, schemaValidation: true },
      limits: {
        maxMessageBytes: 1_000_000,
        maxQueuedCommands: 32,
        maxResultLength: 100_000,
        maxEnumerableElements: 100,
        defaultEvalTimeoutMs: 10_000,
        maxJobConcurrency: 1,
      },
      enforces: [],
    };
  }

  async request(request: RuntimeRequest): Promise<ServerMessage> {
    this.requests.push(request);
    if (request.type === "commands_list" && this.hangCommandsList)
      return new Promise<ServerMessage>(() => {});
    switch (request.type) {
      case "commands_list":
        return {
          type: "commands_list_result",
          id: request.id,
          commands: [
            { name: "compendium.info", majorVersion: 1, kind: "sync", mutatesState: false },
            { name: "compendium.fail", majorVersion: 1, kind: "sync", mutatesState: false },
            { name: "entity.exportBatch", majorVersion: 1, kind: "job", mutatesState: true },
          ],
        };
      case "command_call":
        if (request.name === "compendium.fail") {
          return {
            type: "command_result",
            id: request.id,
            status: "failed",
            output: {},
            artifacts: {},
            durationMs: 0,
            error: {
              kind: "precondition_failed",
              code: "notReady",
              message: "world not ready",
              retryable: true,
              details: { scene: "menu" },
            },
          };
        }
        if (request.name === "entity.exportBatch") {
          return { type: "job_accepted", id: request.id, jobId: "job-1", state: "running" };
        }
        return {
          type: "command_result",
          id: request.id,
          status: "ok",
          output: { ok: true },
          artifacts: { manifest: artifactRef },
          durationMs: 0,
        };
      case "job_status":
        return {
          type: "job_result",
          id: request.id,
          jobId: request.jobId,
          state: "done",
          status: "ok",
          output: { written: 3 },
          artifacts: {},
          durationMs: 1,
        };
      case "job_cancel":
        return {
          type: "job_cancel_result",
          id: request.id,
          jobId: request.jobId,
          accepted: true,
          state: "cancelled",
        };
      default:
        return {
          type: "error",
          id: request.id,
          error: {
            kind: "invalid_request",
            code: "unsupportedTestRequest",
            message: `unsupported ${request.type}`,
            retryable: false,
          },
        };
    }
  }

  async *watch() {}

  async readArtifact(): Promise<Uint8Array> {
    return new Uint8Array();
  }

  onSessionEvicted(): () => void {
    return () => {};
  }

  close(): void {
    this.closed = true;
  }
}

async function testClient(runtime: FakeRuntimeTransport): Promise<SdkControllerClient> {
  const client = new SdkControllerClient("ws://fake", () => connect({ runtime }));
  await client.connect({ timeoutMs: 1, retryIntervalMs: 0 });
  return client;
}

describe("SdkControllerClient", () => {
  it("maps SDK command summaries to controller descriptors", async () => {
    const runtime = new FakeRuntimeTransport();
    const client = await testClient(runtime);

    const commands = await client.describeCommands();

    expect(commands).toEqual([
      { name: "compendium.info", version: 1, kind: "sync", mutatesState: false },
      { name: "compendium.fail", version: 1, kind: "sync", mutatesState: false },
      { name: "entity.exportBatch", version: 1, kind: "job", mutatesState: true },
    ]);
  });

  it("honours the timeout for a command catalog request", async () => {
    const runtime = new FakeRuntimeTransport();
    runtime.hangCommandsList = true;
    const client = await testClient(runtime);

    await expect(client.describeCommands({ timeoutMs: 20 })).rejects.toThrow(
      /HotRepl command catalog timed out after 20 ms/,
    );
    await client.close();
  });

  it("maps SDK command results and artifact refs to controller results", async () => {
    const runtime = new FakeRuntimeTransport();
    const client = await testClient(runtime);

    const result = await client.call("compendium.info", { verbose: true }, { timeoutMs: 42 });

    expect(result).toEqual({
      status: "ok",
      output: { ok: true },
      artifacts: {
        manifest: { logicalName: "manifest", ...artifactRef },
      },
    });
    expect(runtime.requests.at(-1)).toMatchObject({
      type: "command_call",
      name: "compendium.info",
      args: { verbose: true },
      timeoutMs: 42,
    });
  });

  it("wraps SDK HotReplError failures as ControlCommandError", async () => {
    const runtime = new FakeRuntimeTransport();
    const client = await testClient(runtime);

    let error: unknown;
    try {
      await client.call("compendium.fail", {});
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ControlCommandError);
    expect(error).not.toBeInstanceOf(HotReplError);
    expect((error as ControlCommandError).error).toEqual({
      kind: "precondition_failed",
      code: "notReady",
      message: "world not ready",
      retryable: true,
      details: { scene: "menu" },
    });
  });

  it("adapts SDK job handles to startJob and jobStatus", async () => {
    const runtime = new FakeRuntimeTransport();
    const client = await testClient(runtime);

    const accepted = await client.startJob("entity.exportBatch", { runId: "run-1" });
    const result = await client.jobStatus(accepted.jobId);

    expect(accepted).toEqual({ jobId: "job-1", state: "running" });
    expect(result).toEqual({ status: "ok", output: { written: 3 }, artifacts: {} });
    expect(runtime.requests.map((request) => request.type)).toEqual([
      "commands_list",
      "command_call",
      "job_status",
    ]);
  });

  it("cancels known SDK job handles and reports unknown jobs", async () => {
    const runtime = new FakeRuntimeTransport();
    const client = await testClient(runtime);
    const accepted = await client.startJob("entity.exportBatch", { runId: "run-1" });

    await expect(client.cancelJob(accepted.jobId)).resolves.toEqual({
      accepted: true,
      state: "cancelled",
    });
    await expect(client.cancelJob("missing-job")).resolves.toEqual({
      accepted: false,
      state: "unknown",
    });
  });
});
