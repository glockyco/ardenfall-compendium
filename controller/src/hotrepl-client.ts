export interface ControlError {
  kind: string;
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export class ControlCommandError extends Error {
  readonly error: ControlError;

  constructor(error: ControlError) {
    super(error.message);
    this.name = "ControlCommandError";
    this.error = error;
  }
}

export interface ControlCommandDescriptor {
  name: string;
  version: number;
  kind: "sync" | "job";
  mutatesState: boolean;
  inputSchema?: unknown;
  outputSchema?: unknown;
  artifactsSchema?: unknown;
}

export interface ArtifactRef {
  logicalName: string;
  uri: string;
  path?: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  finalized: boolean;
}

export type ArtifactMap = Record<string, ArtifactRef>;

export interface CommandResult {
  status: string;
  output: Record<string, unknown>;
  artifacts: ArtifactMap;
}

export interface CommandAccepted {
  jobId: string;
  state: string;
}

export interface JobStatus {
  jobId: string;
  state: string;
  progress?: unknown;
}

export type JobPollResult = JobStatus | CommandResult;

export interface JobCancelResult {
  accepted: boolean;
  state: string;
}

type JsonObject = Record<string, unknown>;
type Pending = {
  resolve: (value: JsonObject) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export class HotReplClient {
  private readonly url: string;
  private ws?: WebSocket;
  private counter = 0;
  private readonly pending = new Map<string, Pending>();

  constructor(url: string) {
    this.url = url;
  }

  async connect(options: { timeoutMs?: number; retryIntervalMs?: number } = {}): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    const deadline = options.timeoutMs === undefined ? undefined : Date.now() + options.timeoutMs;
    const retryIntervalMs = options.retryIntervalMs ?? 1_000;
    for (;;) {
      try {
        const remaining = deadline === undefined ? undefined : Math.max(1, deadline - Date.now());
        await this.connectOnce(remaining);
        return;
      } catch (error) {
        this.ws?.close();
        this.ws = undefined;
        if (deadline === undefined || Date.now() >= deadline) throw error;
        await Bun.sleep(Math.min(retryIntervalMs, Math.max(0, deadline - Date.now())));
      }
    }
  }

  private async connectOnce(timeoutMs = 10_000): Promise<void> {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.addEventListener("message", (event) => this.handleMessage(event));
    ws.addEventListener("error", () => this.rejectAll(new Error("HotRepl WebSocket error")));
    ws.addEventListener("close", () => this.rejectAll(new Error("HotRepl WebSocket closed")));

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for HotRepl handshake"));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timeout);
        ws.removeEventListener("message", onMessage);
        ws.removeEventListener("error", onError);
        ws.removeEventListener("close", onClose);
      };
      const onMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(String(event.data)) as JsonObject;
          if (data.type !== "handshake") return;
          const protocolVersion = Number(data.protocolVersion);
          if (protocolVersion !== 2) {
            cleanup();
            reject(
              new Error(
                `Unsupported HotRepl protocolVersion ${String(data.protocolVersion)}; expected 2`,
              ),
            );
            return;
          }
          cleanup();
          resolve();
        } catch (error) {
          cleanup();
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };
      const onError = () => {
        cleanup();
        reject(new Error("Failed to connect to HotRepl"));
      };
      const onClose = () => {
        cleanup();
        reject(new Error("HotRepl WebSocket closed before handshake"));
      };
      ws.addEventListener("message", onMessage);
      ws.addEventListener("error", onError, { once: true });
      ws.addEventListener("close", onClose, { once: true });
    });
  }

  async describeCommands(): Promise<ControlCommandDescriptor[]> {
    const response = await this.request({ type: "commands_list", id: this.nextId() });
    if (response.type !== "commands_list_result")
      throw new Error(`Expected commands_list_result, got ${String(response.type)}`);
    const commands = Array.isArray(response.commands) ? response.commands : [];
    return commands.filter(isObject).map(parseDescriptor);
  }

  async call(
    name: string,
    args: JsonObject,
    options: { timeoutMs?: number } = {},
  ): Promise<CommandResult> {
    const response = await this.request(this.commandPayload(name, args, options));
    if (response.type !== "command_result")
      throw new Error(`Expected command_result, got ${String(response.type)}`);
    return parseCommandResult(response);
  }

  async startJob(
    name: string,
    args: JsonObject,
    options: { timeoutMs?: number } = {},
  ): Promise<CommandAccepted> {
    const response = await this.request(this.commandPayload(name, args, options));
    if (response.type !== "job_accepted")
      throw new Error(`Expected job_accepted, got ${String(response.type)}`);
    return { jobId: String(response.jobId), state: String(response.state) };
  }

  async jobStatus(jobId: string): Promise<JobPollResult> {
    const response = await this.request(this.jobPayload("job_status", jobId));
    if (response.type === "job_result") return parseCommandResult(response);
    if (response.type !== "job_status_result")
      throw new Error(`Expected job_status_result or job_result, got ${String(response.type)}`);
    const status: JobStatus = { jobId: String(response.jobId), state: String(response.state) };
    if (response.progress !== undefined) status.progress = response.progress;
    return status;
  }

  async cancelJob(jobId: string): Promise<JobCancelResult> {
    const response = await this.request(this.jobPayload("job_cancel", jobId));
    if (response.type !== "job_cancel_result")
      throw new Error(`Expected job_cancel_result, got ${String(response.type)}`);
    return { accepted: Boolean(response.accepted), state: String(response.state) };
  }

  async close(): Promise<void> {
    const ws = this.ws;
    this.ws = undefined;
    if (!ws || ws.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolve) => {
      ws.addEventListener("close", () => resolve(), { once: true });
      ws.close();
      setTimeout(resolve, 100).unref?.();
    });
  }

  private commandPayload(
    name: string,
    args: JsonObject,
    options: { timeoutMs?: number },
  ): JsonObject {
    const payload: JsonObject = { type: "command_call", id: this.nextId(), name, args };
    if (options.timeoutMs !== undefined) payload.timeoutMs = options.timeoutMs;
    return payload;
  }

  private jobPayload(type: string, jobId: string): JsonObject {
    return { type, id: this.nextId(), jobId };
  }

  private async request(payload: JsonObject): Promise<JsonObject> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error("HotReplClient is not connected.");
    const id = String(payload.id);
    const timeoutMs =
      typeof payload.timeoutMs === "number" && Number.isFinite(payload.timeoutMs)
        ? Math.max(1, payload.timeoutMs)
        : 10_000;
    const promise = new Promise<JsonObject>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${String(payload.type)}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
    });
    ws.send(JSON.stringify(payload));
    return await promise;
  }

  private handleMessage(event: MessageEvent): void {
    const response = JSON.parse(String(event.data)) as JsonObject;
    const id = typeof response.id === "string" ? response.id : undefined;
    if (!id) return;
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    clearTimeout(pending.timeout);
    if (response.type === "error" || response.type === "command_error") {
      pending.reject(
        new ControlCommandError(
          parseControlError(isObject(response.error) ? response.error : undefined),
        ),
      );
      return;
    }
    pending.resolve(response);
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
  }

  private nextId(): string {
    this.counter += 1;
    return `controller-${this.counter}`;
  }
}

function parseControlError(data: JsonObject | undefined): ControlError {
  if (!data)
    return {
      kind: "internal",
      code: "missingError",
      message: "Control command failed without error details.",
      retryable: false,
    };
  const error: ControlError = {
    kind: String(data.kind ?? ""),
    code: String(data.code ?? ""),
    message: String(data.message ?? ""),
    retryable: Boolean(data.retryable),
  };
  if (data.details !== undefined) error.details = data.details;
  return error;
}

function parseDescriptor(data: JsonObject): ControlCommandDescriptor {
  const descriptor: ControlCommandDescriptor = {
    name: String(data.name),
    version: Number(data.majorVersion ?? data.version),
    kind: data.kind === "job" ? "job" : "sync",
    mutatesState: Boolean(data.mutatesState),
  };
  if (data.inputSchema !== undefined) descriptor.inputSchema = data.inputSchema;
  if (data.outputSchema !== undefined) descriptor.outputSchema = data.outputSchema;
  if (data.artifactsSchema !== undefined) descriptor.artifactsSchema = data.artifactsSchema;
  return descriptor;
}

function parseCommandResult(data: JsonObject): CommandResult {
  if (data.status === "failed") {
    throw new ControlCommandError(parseControlError(isObject(data.error) ? data.error : undefined));
  }
  return {
    status: String(data.status),
    output: isObject(data.output) ? data.output : {},
    artifacts: isObject(data.artifacts) ? parseArtifacts(data.artifacts) : {},
  };
}

function parseArtifacts(data: JsonObject): ArtifactMap {
  const artifacts: ArtifactMap = {};
  for (const [logicalName, value] of Object.entries(data)) {
    if (isObject(value)) artifacts[logicalName] = parseArtifact(logicalName, value);
  }
  return artifacts;
}

function parseArtifact(logicalName: string, data: JsonObject): ArtifactRef {
  const artifact: ArtifactRef = {
    logicalName,
    uri: String(data.uri),
    contentType: String(data.contentType),
    byteSize: Number(data.byteSize),
    sha256: String(data.sha256),
    finalized: Boolean(data.finalized),
  };
  if (typeof data.path === "string") artifact.path = data.path;
  return artifact;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
