import { afterEach, describe, expect, it } from "bun:test";
import { HotReplClient, type ControlCommandError } from "../src/hotrepl-client";

type RecordedMessage = Record<string, unknown>;

function startFakeControlServer(options: { commandDelayMs?: number; port?: number } = {}) {
  const messages: RecordedMessage[] = [];
  const server = Bun.serve<{ url: string }>({
    port: options.port ?? 0,
    fetch(req, server) {
      if (server.upgrade(req)) return undefined;
      return new Response("expected websocket", { status: 426 });
    },
    websocket: {
      open(ws) {
        ws.send(JSON.stringify({ type: "hello", protocolVersion: 1 }));
      },
      async message(ws, raw) {
        const message = JSON.parse(String(raw)) as RecordedMessage;
        messages.push(message);
        if (options.commandDelayMs && message.type === "command_call")
          await Bun.sleep(options.commandDelayMs);
        const id = message.id;
        switch (message.type) {
          case "control_auth":
            ws.send(
              JSON.stringify({ type: "control_auth_result", id, ok: true, sessionId: "session-1" }),
            );
            break;
          case "lease_acquire":
            ws.send(
              JSON.stringify({ type: "lease_acquire_result", id, ok: true, leaseId: "lease-1" }),
            );
            break;
          case "command_describe":
            ws.send(
              JSON.stringify({
                type: "command_describe_result",
                id,
                commands: [
                  {
                    name: "compendium.info",
                    version: 1,
                    kind: "sync",
                    mutatesState: false,
                    argsSchema: {},
                    resultSchema: {},
                  },
                ],
              }),
            );
            break;
          case "command_call":
            if (message.name === "compendium.fail") {
              ws.send(
                JSON.stringify({
                  type: "command_error",
                  id,
                  status: "failed",
                  error: {
                    kind: "validation_failed",
                    code: "bad",
                    message: "bad args",
                    retryable: false,
                  },
                  diagnostics: [],
                }),
              );
            } else if (message.name === "entity.exportBatch") {
              ws.send(
                JSON.stringify({ type: "command_accepted", id, jobId: "job-1", state: "accepted" }),
              );
            } else {
              ws.send(
                JSON.stringify({
                  type: "command_result",
                  id,
                  status: "ok",
                  result: { ok: true },
                  artifacts: [],
                  diagnostics: [],
                }),
              );
            }
            break;
          case "job_status":
            ws.send(
              JSON.stringify({
                type: "job_status_result",
                id,
                jobId: message.jobId,
                state: "completed",
                progress: { done: true },
              }),
            );
            break;
          case "job_result":
            ws.send(
              JSON.stringify({
                type: "job_result",
                id,
                status: "ok",
                result: { written: 1 },
                artifacts: [],
                diagnostics: [],
              }),
            );
            break;
          case "job_cancel":
            ws.send(
              JSON.stringify({
                type: "job_cancel_result",
                id,
                accepted: true,
                state: "cancelling",
              }),
            );
            break;
          default:
            ws.send(
              JSON.stringify({
                type: "command_error",
                id,
                status: "failed",
                error: {
                  kind: "invalid_request",
                  code: "unknown",
                  message: "unknown",
                  retryable: false,
                },
                diagnostics: [],
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

describe("HotReplClient", () => {
  const servers: Array<{ stop: () => void }> = [];

  afterEach(() => {
    for (const server of servers.splice(0)) server.stop();
  });

  it("describes commands and sends command calls with args and lease", async () => {
    const server = startFakeControlServer();
    servers.push(server);
    const client = new HotReplClient(server.url);
    await client.connect();
    await client.authenticate("secret");
    await client.acquireLease("ardenfall-controller");

    const commands = await client.describeCommands();
    const result = await client.call("compendium.info", { verbose: true });
    await client.close();

    expect(commands[0]).toMatchObject({ name: "compendium.info", version: 1, kind: "sync" });
    expect(result.result).toEqual({ ok: true });
    expect(server.messages.map((message) => message.type)).toEqual([
      "control_auth",
      "lease_acquire",
      "command_describe",
      "command_call",
    ]);
    expect(server.messages[1]).toMatchObject({
      type: "lease_acquire",
      sessionId: "session-1",
      clientName: "ardenfall-controller",
    });
    expect(server.messages[3]).toMatchObject({
      type: "command_call",
      name: "compendium.info",
      args: { verbose: true },
      leaseId: "lease-1",
    });
  });

  it("supports job lifecycle messages", async () => {
    const server = startFakeControlServer();
    servers.push(server);
    const client = new HotReplClient(server.url);
    await client.connect();
    await client.authenticate();
    await client.acquireLease("ardenfall-controller");

    const accepted = await client.startJob("entity.exportBatch", { runId: "run-1" });
    const status = await client.jobStatus(accepted.jobId);
    const result = await client.jobResult(accepted.jobId);
    const cancel = await client.cancelJob(accepted.jobId);
    await client.close();

    expect(accepted).toEqual({ jobId: "job-1", state: "accepted" });
    expect(status).toEqual({ jobId: "job-1", state: "completed", progress: { done: true } });
    expect(result.result).toEqual({ written: 1 });
    expect(cancel).toEqual({ accepted: true, state: "cancelling" });
    expect(server.messages.at(-3)).toMatchObject({
      type: "job_status",
      jobId: "job-1",
      leaseId: "lease-1",
    });
  });

  it("rejects command_error with typed control error", async () => {
    const server = startFakeControlServer();
    servers.push(server);
    const client = new HotReplClient(server.url);
    await client.connect();

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
    await client.connect();

    await expect(client.call("compendium.info", {}, { timeoutMs: 5 })).rejects.toThrow(
      "Timed out waiting for command_call",
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
