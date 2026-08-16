import { SdkControllerClient } from "./sdk-control-client";
import { exportCompendium } from "./export-orchestrator";

interface CliOptions {
  url: string;
  outputBaseDir: string;
  pipelineOutDir: string;
  waitForWorld: boolean;
  noQuit: boolean;
}

async function main(argv: string[]): Promise<void> {
  const [command, ...args] = argv;
  if (command !== "export")
    throw new Error(
      "Usage: controller export --url <ws-url> --output <dir> --pipeline-out <dir> [--no-wait-for-world] [--no-quit]",
    );
  const options = parseArgs(args);
  const client = new SdkControllerClient(options.url);
  try {
    const result = await exportCompendium({
      client,
      outputBaseDir: options.outputBaseDir,
      pipelineOutDir: options.pipelineOutDir,
      waitForWorld: options.waitForWorld,
      noQuit: options.noQuit,
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
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`Invalid argument near ${key}`);
    values.set(key, value);
    i += 2;
  }
  const url = values.get("--url");
  const outputBaseDir = values.get("--output");
  const pipelineOutDir = values.get("--pipeline-out");
  if (!url) throw new Error("--url is required");
  if (!outputBaseDir) throw new Error("--output is required");
  if (!pipelineOutDir) throw new Error("--pipeline-out is required");
  return { url, outputBaseDir, pipelineOutDir, waitForWorld, noQuit };
}

if (import.meta.main) {
  main(Bun.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
