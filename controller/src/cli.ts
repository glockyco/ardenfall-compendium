import { HotReplClient } from "./hotrepl-client";
import { exportCompendium } from "./export-orchestrator";

interface CliOptions {
  url: string;
  outputBaseDir: string;
  pipelineOutDir: string;
  token?: string;
}

async function main(argv: string[]): Promise<void> {
  const [command, ...args] = argv;
  if (command !== "export")
    throw new Error(
      "Usage: controller export --url <ws-url> --output <dir> --pipeline-out <dir> [--token <token>]",
    );
  const options = parseArgs(args);
  const client = new HotReplClient(options.url);
  try {
    const result = await exportCompendium({
      client,
      outputBaseDir: options.outputBaseDir,
      pipelineOutDir: options.pipelineOutDir,
      token: options.token,
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
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!key?.startsWith("--") || value === undefined)
      throw new Error(`Invalid argument near ${key ?? "<end>"}`);
    values.set(key, value);
  }
  const url = values.get("--url");
  const outputBaseDir = values.get("--output");
  const pipelineOutDir = values.get("--pipeline-out");
  if (!url) throw new Error("--url is required");
  if (!outputBaseDir) throw new Error("--output is required");
  if (!pipelineOutDir) throw new Error("--pipeline-out is required");
  const token = values.get("--token");
  return token === undefined
    ? { url, outputBaseDir, pipelineOutDir }
    : { url, outputBaseDir, pipelineOutDir, token };
}

if (import.meta.main) {
  main(Bun.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
