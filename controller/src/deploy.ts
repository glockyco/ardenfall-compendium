import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface DeployOptions {
  hotReplOutDir: string;
  ardenfallModOutDir: string;
  pluginsDir: string;
}

export interface DeployResult {
  copied: string[];
}

const HOTREPL_DLLS = ["HotRepl.BepInEx.dll", "HotRepl.Core.dll", "mcs.dll"];
const ARDENFALL_DLLS = ["ArdenfallArchives.dll"];

export async function deployPlugins(options: DeployOptions): Promise<DeployResult> {
  const sources = [
    ...HOTREPL_DLLS.map((name) => ({
      name,
      source: join(options.hotReplOutDir, name),
      target: join(options.pluginsDir, "HotRepl", name),
    })),
    ...ARDENFALL_DLLS.map((name) => ({
      name,
      source: join(options.ardenfallModOutDir, name),
      target: join(options.pluginsDir, "ArdenfallArchives", name),
    })),
  ];

  for (const entry of sources) await requireFile(entry.source);

  for (const entry of sources) {
    await mkdir(dirname(entry.target), { recursive: true });
    await copyFile(entry.source, entry.target);
  }

  return { copied: sources.map((entry) => entry.name) };
}

async function requireFile(path: string): Promise<void> {
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error(`Missing deploy source: ${path}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing deploy source:")) throw error;
    throw new Error(`Missing deploy source: ${path}`);
  }
}

function parseArgs(args: string[]): DeployOptions {
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!key?.startsWith("--") || value === undefined)
      throw new Error(`Invalid argument near ${key ?? "<end>"}`);
    values.set(key, value);
  }

  const hotReplOutDir = values.get("--hotrepl-out");
  const ardenfallModOutDir = values.get("--mod-out");
  const pluginsDir = values.get("--plugins");
  if (!hotReplOutDir) throw new Error("--hotrepl-out is required");
  if (!ardenfallModOutDir) throw new Error("--mod-out is required");
  if (!pluginsDir) throw new Error("--plugins is required");
  return { hotReplOutDir, ardenfallModOutDir, pluginsDir };
}

if (import.meta.main) {
  deployPlugins(parseArgs(Bun.argv.slice(2)))
    .then((result) => {
      process.stdout.write(`${JSON.stringify({ status: "deployed", ...result })}\n`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
