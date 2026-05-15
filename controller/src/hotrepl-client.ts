export interface ControlError {
  kind: string;
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export class ControlCommandError extends Error {
  readonly error: ControlError;
  readonly diagnostics: ControlError[];

  constructor(error: ControlError, diagnostics: ControlError[] = []) {
    super(error.message);
    this.name = "ControlCommandError";
    this.error = error;
    this.diagnostics = diagnostics;
  }
}

export interface ControlCommandDescriptor {
  name: string;
  version: number;
  kind: "sync" | "job";
  mutatesState: boolean;
  argsSchema: unknown;
  resultSchema: unknown;
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

export interface CommandResult {
  status: string;
  result: Record<string, unknown>;
  artifacts: ArtifactRef[];
  diagnostics: ControlError[];
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
  private sessionId?: string;
  private leaseId?: string;
  private readonly pending = new Map<string, Pending>();

  constructor(url: string) {
    this.url = url;
  }

  async connect(options: { timeoutMs?: number; retryIntervalMs?: number } = {}): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    const deadline = Date.now() + (options.timeoutMs ?? 0);
    const retryIntervalMs = options.retryIntervalMs ?? 1_000;
    for (;;) {
      try {
        await this.connectOnce();
        return;
      } catch (error) {
        this.ws?.close();
        this.ws = undefined;
        if (options.timeoutMs === undefined || Date.now() >= deadline) throw error;
        await Bun.sleep(Math.min(retryIntervalMs, Math.max(0, deadline - Date.now())));
      }
    }
  }

  private async connectOnce(): Promise<void> {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.addEventListener("message", (event) => this.handleMessage(event));
    ws.addEventListener("error", () => this.rejectAll(new Error("HotRepl WebSocket error")));
    ws.addEventListener("close", () => this.rejectAll(new Error("HotRepl WebSocket closed")));
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("error", () => reject(new Error("Failed to connect to HotRepl")), {
        once: true,
      });
    });
  }

  async authenticate(
    token?: string,
  ): Promise<{ ok: boolean; sessionId?: string; error?: ControlError }> {
    const payload: JsonObject = { type: "control_auth", id: this.nextId() };
    if (token !== undefined) payload.token = token;
    const response = await this.request(payload);
    const result = {
      ok: Boolean(response.ok),
      sessionId: typeof response.sessionId === "string" ? response.sessionId : undefined,
      error: isObject(response.error) ? parseControlError(response.error) : undefined,
    };
    if (result.ok && result.sessionId) this.sessionId = result.sessionId;
    return result;
  }

  async acquireLease(
    clientName: string,
  ): Promise<{ ok: boolean; leaseId?: string; error?: ControlError }> {
    if (!this.sessionId) await this.authenticate();
    const response = await this.request({
      type: "lease_acquire",
      id: this.nextId(),
      sessionId: this.sessionId,
      clientName,
    });
    const result = {
      ok: Boolean(response.ok),
      leaseId: typeof response.leaseId === "string" ? response.leaseId : undefined,
      error: isObject(response.error) ? parseControlError(response.error) : undefined,
    };
    if (result.ok && result.leaseId) this.leaseId = result.leaseId;
    return result;
  }

  async describeCommands(): Promise<ControlCommandDescriptor[]> {
    const response = await this.request({ type: "command_describe", id: this.nextId() });
    const commands = Array.isArray(response.commands) ? response.commands : [];
    return commands.filter(isObject).map(parseDescriptor);
  }

  async call(
    name: string,
    args: JsonObject,
    options: { timeoutMs?: number; idempotencyKey?: string } = {},
  ): Promise<CommandResult> {
    const response = await this.request(this.commandPayload(name, args, options));
    if (response.type !== "command_result")
      throw new Error(`Expected command_result, got ${String(response.type)}`);
    return parseCommandResult(response);
  }

  async startJob(
    name: string,
    args: JsonObject,
    options: { timeoutMs?: number; idempotencyKey?: string } = {},
  ): Promise<CommandAccepted> {
    const response = await this.request(this.commandPayload(name, args, options));
    if (response.type !== "command_accepted")
      throw new Error(`Expected command_accepted, got ${String(response.type)}`);
    return { jobId: String(response.jobId), state: String(response.state) };
  }

  async jobStatus(jobId: string): Promise<JobStatus> {
    const response = await this.request(this.jobPayload("job_status", jobId));
    const status: JobStatus = { jobId: String(response.jobId), state: String(response.state) };
    if (response.progress !== undefined) status.progress = response.progress;
    return status;
  }

  async jobResult(jobId: string): Promise<CommandResult> {
    const response = await this.request(this.jobPayload("job_result", jobId));
    if (response.type !== "job_result")
      throw new Error(`Expected job_result, got ${String(response.type)}`);
    return parseCommandResult(response);
  }

  async cancelJob(jobId: string): Promise<JobCancelResult> {
    const response = await this.request(this.jobPayload("job_cancel", jobId));
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
    options: { timeoutMs?: number; idempotencyKey?: string },
  ): JsonObject {
    const payload: JsonObject = { type: "command_call", id: this.nextId(), name, args };
    if (this.leaseId) payload.leaseId = this.leaseId;
    if (options.timeoutMs !== undefined) payload.timeoutMs = options.timeoutMs;
    if (options.idempotencyKey !== undefined) payload.idempotencyKey = options.idempotencyKey;
    return payload;
  }

  private jobPayload(type: string, jobId: string): JsonObject {
    const payload: JsonObject = { type, id: this.nextId(), jobId };
    if (this.leaseId) payload.leaseId = this.leaseId;
    return payload;
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
    if (response.type === "command_error") {
      pending.reject(
        new ControlCommandError(
          parseControlError(isObject(response.error) ? response.error : undefined),
          Array.isArray(response.diagnostics)
            ? response.diagnostics.filter(isObject).map(parseControlError)
            : [],
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
  return {
    name: String(data.name),
    version: Number(data.version),
    kind: data.kind === "job" ? "job" : "sync",
    mutatesState: Boolean(data.mutatesState),
    argsSchema: data.argsSchema ?? {},
    resultSchema: data.resultSchema ?? {},
  };
}

function parseCommandResult(data: JsonObject): CommandResult {
  return {
    status: String(data.status),
    result: isObject(data.result) ? data.result : {},
    artifacts: Array.isArray(data.artifacts)
      ? data.artifacts.filter(isObject).map(parseArtifact)
      : [],
    diagnostics: Array.isArray(data.diagnostics)
      ? data.diagnostics.filter(isObject).map(parseControlError)
      : [],
  };
}

function parseArtifact(data: JsonObject): ArtifactRef {
  const artifact: ArtifactRef = {
    logicalName: String(data.logicalName),
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
