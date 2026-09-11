import { SdkControllerClient } from "./sdk-control-client";
import { exportCompendium, type MapCaptureExportOptions } from "./export-orchestrator";

interface CliOptions {
  url: string;
  outputBaseDir: string;
  pipelineOutDir: string;
  pluginsDir: string;
  waitForWorld: boolean;
  noQuit: boolean;
  capture?: MapCaptureExportOptions;
}

async function main(argv: string[]): Promise<void> {
  const [command, ...args] = argv;
  if (command !== "export")
    throw new Error(
      "Usage: controller export --url <ws-url> --output <dir> --pipeline-out <dir> --plugins <dir> [--capture-map <id> --capture-min-x <n> --capture-min-y <n> --capture-max-x <n> --capture-max-y <n> --capture-pixels-per-unit <n> [--capture-authored-only]] [--no-wait-for-world] [--no-quit]",
    );
  const options = parseArgs(args);
  const client = new SdkControllerClient(options.url);
  try {
    const result = await exportCompendium({
      client,
      url: options.url,
      outputBaseDir: options.outputBaseDir,
      pipelineOutDir: options.pipelineOutDir,
      pluginsDir: options.pluginsDir,
      waitForWorld: options.waitForWorld,
      noQuit: options.noQuit,
      ...(options.capture === undefined ? {} : { capture: options.capture }),
      log: (event) => process.stdout.write(`${JSON.stringify(event)}\n`),
    });
    process.stdout.write(
      `${JSON.stringify({ phase: "export", status: "completed", ...result })}\n`,
    );
  } finally {
    await client.close();
  }
}

function parseArgs(args: string[]): CliOptions {
  const values = new Map<string, string>();
  let waitForWorld = true;
  // Leaving the game running is what lets one session produce two exports, which is
  // how the reproducibility check compares counts without a reload in between.
  let noQuit = false;
  let captureAuthoredOnly = false;
  for (let i = 0; i < args.length;) {
    const key = args[i];
    if (!key?.startsWith("--")) throw new Error(`Invalid argument near ${key ?? "<end>"}`);
    if (key === "--no-wait-for-world") {
      waitForWorld = false;
      i += 1;
      continue;
    }
    if (key === "--no-quit") {
      noQuit = true;
      i += 1;
      continue;
    }
    if (key === "--capture-authored-only") {
      captureAuthoredOnly = true;
      i += 1;
      continue;
    }
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`Invalid argument near ${key}`);
    values.set(key, value);
    i += 2;
  }
  const url = values.get("--url");
  const outputBaseDir = values.get("--output");
  const pipelineOutDir = values.get("--pipeline-out");
  // The export proves which plugin answered by comparing it against the deployed one, so the
  // plugin directory is required. An optional value here would switch that proof off silently.
  const pluginsDir = values.get("--plugins");
  if (!url) throw new Error("--url is required");
  if (!outputBaseDir) throw new Error("--output is required");
  if (!pipelineOutDir) throw new Error("--pipeline-out is required");
  if (!pluginsDir) throw new Error("--plugins is required");

  const captureKeys = [
    "--capture-map",
    "--capture-min-x",
    "--capture-min-y",
    "--capture-max-x",
    "--capture-max-y",
    "--capture-pixels-per-unit",
  ] as const;
  const captureRequested = captureAuthoredOnly || captureKeys.some((key) => values.has(key));
  let capture: MapCaptureExportOptions | undefined;
  if (captureRequested) {
    for (const key of captureKeys) {
      if (!values.has(key)) throw new Error(`${key} is required when capture is enabled`);
    }
    const number = (key: (typeof captureKeys)[number]): number => {
      const parsed = Number(values.get(key));
      if (!Number.isFinite(parsed)) throw new Error(`${key} must be a finite number`);
      return parsed;
    };
    capture = {
      mapId: values.get("--capture-map")!,
      minCellX: number("--capture-min-x"),
      minCellY: number("--capture-min-y"),
      maxCellX: number("--capture-max-x"),
      maxCellY: number("--capture-max-y"),
      pixelsPerUnit: number("--capture-pixels-per-unit"),
      ...(captureAuthoredOnly ? { authoredOnly: true } : {}),
    };
  }
  return {
    url,
    outputBaseDir,
    pipelineOutDir,
    pluginsDir,
    waitForWorld,
    noQuit,
    ...(capture === undefined ? {} : { capture }),
  };
}

if (import.meta.main) {
  main(Bun.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
