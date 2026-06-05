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
