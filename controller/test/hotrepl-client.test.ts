import { afterEach, describe, expect, it } from "bun:test";
import { HotReplClient, type CommandResult, type ControlCommandError } from "../src/hotrepl-client";

type RecordedMessage = Record<string, unknown>;

function startFakeControlServer(
  options: {
    commandDelayMs?: number;
    commandsListDelayMs?: number;
    port?: number;
    protocolVersion?: number;
  } = {},
) {
  const messages: RecordedMessage[] = [];
  const server = Bun.serve<{ url: string }>({
    port: options.port ?? 0,
    fetch(req, server) {
      if (server.upgrade(req)) return undefined;
      return new Response("expected websocket", { status: 426 });
    },
    websocket: {
      open(ws) {
        ws.send(
          JSON.stringify({ type: "handshake", protocolVersion: options.protocolVersion ?? 2 }),
        );
      },
      async message(ws, raw) {
        const message = JSON.parse(String(raw)) as RecordedMessage;
        messages.push(message);
        if (options.commandDelayMs && message.type === "command_call")
          await Bun.sleep(options.commandDelayMs);
        const id = message.id;
        if (options.commandsListDelayMs && message.type === "commands_list")
          await Bun.sleep(options.commandsListDelayMs);
        switch (message.type) {
          case "commands_list":
            ws.send(
              JSON.stringify({
                type: "commands_list_result",
                id,
                commands: [
                  {
                    name: "compendium.info",
                    majorVersion: 1,
                    kind: "sync",
                    mutatesState: false,
                  },
                ],
              }),
            );
            break;
          case "command_call":
            if (message.name === "compendium.fail") {
              ws.send(
                JSON.stringify({
                  type: "command_result",
                  id,
                  status: "failed",
                  output: {},
                  artifacts: {},
                  error: {
                    kind: "validation_failed",
                    code: "bad",
                    message: "bad args",
                    retryable: false,
                  },
                  durationMs: 0,
                }),
              );
            } else if (message.name === "entity.exportBatch") {
              ws.send(
                JSON.stringify({ type: "job_accepted", id, jobId: "job-1", state: "running" }),
              );
            } else {
              ws.send(
                JSON.stringify({
                  type: "command_result",
                  id,
                  status: "ok",
                  output: { ok: true },
                  artifacts: {
                    manifest: {
                      uri: "file:///tmp/manifest.json",
                      path: "/tmp/manifest.json",
                      contentType: "application/json",
                      byteSize: 2,
                      sha256: "abc",
                      finalized: true,
                    },
                  },
                  durationMs: 0,
                }),
              );
            }
            break;
          case "job_status":
            ws.send(
              JSON.stringify({
                type: "job_result",
                id,
                jobId: message.jobId,
                state: "done",
                status: "ok",
                output: { written: 1 },
                artifacts: {},
                durationMs: 1,
              }),
            );
            break;
          case "job_cancel":
            ws.send(
              JSON.stringify({
                type: "job_cancel_result",
                id,
                accepted: true,
                state: "cancelled",
              }),
            );
            break;
          default:
            ws.send(
              JSON.stringify({
                type: "error",
                id,
                error: {
                  kind: "invalid_request",
                  code: "unknown",
                  message: "unknown",
                  retryable: false,
                },
              }),
            );
        }
      },
    },
  });

  return {
    url: `ws://127.0.0.1:${server.port}`,
    messages,
    stop: () => server.stop(true),
  };
}

function isCommandResult(value: unknown): value is CommandResult {
  return typeof value === "object" && value !== null && "output" in value;
}

async function connectTestClient(client: HotReplClient): Promise<void> {
  await client.connect({ timeoutMs: 2_000, retryIntervalMs: 10 });
}

describe("HotReplClient", () => {
  const servers: Array<{ stop: () => void }> = [];

  afterEach(() => {
    for (const server of servers.splice(0)) server.stop();
  });

  it("waits for handshake, lists commands, and sends calls without auth or lease", async () => {
    const server = startFakeControlServer();
    servers.push(server);
    const client = new HotReplClient(server.url);
    await connectTestClient(client);

    const commands = await client.describeCommands();
    const result = await client.call("compendium.info", { verbose: true });
    await client.close();

    expect(commands[0]).toMatchObject({ name: "compendium.info", version: 1, kind: "sync" });
    expect(result.output).toEqual({ ok: true });
    expect(result.artifacts.manifest).toMatchObject({
      logicalName: "manifest",
      path: "/tmp/manifest.json",
      finalized: true,
    });
    expect(server.messages.map((message) => message.type)).toEqual([
      "commands_list",
      "command_call",
    ]);
    expect(server.messages[1]).toMatchObject({
      type: "command_call",
      name: "compendium.info",
      args: { verbose: true },
    });
    expect(server.messages[1]).not.toHaveProperty("leaseId");
  });

  it("returns terminal job results from job_status without a job_result request", async () => {
    const server = startFakeControlServer();
    servers.push(server);
    const client = new HotReplClient(server.url);
    await connectTestClient(client);

    const accepted = await client.startJob("entity.exportBatch", { runId: "run-1" });
    const terminal = await client.jobStatus(accepted.jobId);
    const cancel = await client.cancelJob(accepted.jobId);
    await client.close();

    expect(accepted).toEqual({ jobId: "job-1", state: "running" });
    expect(isCommandResult(terminal)).toBe(true);
    if (!isCommandResult(terminal)) throw new Error("expected terminal command result");
    expect(terminal.output).toEqual({ written: 1 });
    expect(cancel).toEqual({ accepted: true, state: "cancelled" });
    expect(server.messages.map((message) => message.type)).toEqual([
      "command_call",
      "job_status",
      "job_cancel",
    ]);
  });

  it("rejects failed command_result with typed control error", async () => {
    const server = startFakeControlServer();
    servers.push(server);
    const client = new HotReplClient(server.url);
    await connectTestClient(client);

    let error: ControlCommandError | undefined;
    try {
      await client.call("compendium.fail", {});
    } catch (err) {
      error = err as ControlCommandError;
    } finally {
      await client.close();
    }

    expect(error?.error).toMatchObject({
      kind: "validation_failed",
      code: "bad",
      message: "bad args",
      retryable: false,
    });
  });

  it("applies command timeoutMs to the local response wait", async () => {
    const server = startFakeControlServer({ commandDelayMs: 30 });
    servers.push(server);
    const client = new HotReplClient(server.url);
    await connectTestClient(client);

    await expect(client.call("compendium.info", {}, { timeoutMs: 5 })).rejects.toThrow(
      "Timed out waiting for command_call",
    );
    await client.close();
  });

  it("applies timeoutMs to the command catalog wait", async () => {
    const server = startFakeControlServer({ commandsListDelayMs: 30 });
    servers.push(server);
    const client = new HotReplClient(server.url);
    await connectTestClient(client);

    await expect(client.describeCommands({ timeoutMs: 5 })).rejects.toThrow(
      "Timed out waiting for commands_list",
    );
    await client.close();
  });

  it("rejects incompatible handshake protocol versions", async () => {
    const server = startFakeControlServer({ protocolVersion: 999 });
    servers.push(server);
    const client = new HotReplClient(server.url);

    await expect(client.connect()).rejects.toThrow(
      "Unsupported HotRepl protocolVersion 999; expected 2",
    );
    await client.close();
  });

  it("waits for a delayed HotRepl listener during first startup", async () => {
    let server: ReturnType<typeof startFakeControlServer> | undefined;
    const port = 18591;
    setTimeout(() => {
      server = startFakeControlServer({ port });
      servers.push(server);
    }, 30);
    const client = new HotReplClient(`ws://127.0.0.1:${port}`);

    await client.connect({ timeoutMs: 500, retryIntervalMs: 10 });
    await client.close();
  });
});
