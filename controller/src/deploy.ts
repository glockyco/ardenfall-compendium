import { copyFile, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface DeployOptions {
  hotReplOutDir: string;
  ardenfallModOutDir: string;
  pluginsDir: string;
  bindHost?: string;
  allowRemoteRepl?: boolean;
  port?: number;
}

export interface DeployResult {
  copied: string[];
}

const REQUIRED_HOTREPL_DLLS = ["HotRepl.BepInEx.dll", "HotRepl.Core.dll", "mcs.dll"];
const ARDENFALL_DLLS = ["ArdenfallCompendium.dll"];

export async function deployPlugins(options: DeployOptions): Promise<DeployResult> {
  await removeObsoletePlugins(options.pluginsDir);

  for (const name of REQUIRED_HOTREPL_DLLS) await requireFile(join(options.hotReplOutDir, name));
  const sources = [
    ...(await hotReplDllSources(options.hotReplOutDir, options.pluginsDir)),
    ...ARDENFALL_DLLS.map((name) => ({
      name,
      source: join(options.ardenfallModOutDir, name),
      target: join(options.pluginsDir, "ArdenfallCompendium", name),
    })),
  ];

  for (const entry of sources) await requireFile(entry.source);

  for (const entry of sources) {
    await mkdir(dirname(entry.target), { recursive: true });
    await copyFile(entry.source, entry.target);
  }
  await writeHotReplConfig(options);

  return { copied: sources.map((entry) => entry.name) };
}

async function removeObsoletePlugins(pluginsDir: string): Promise<void> {
  await rm(join(pluginsDir, "ArdenfallArchives"), { recursive: true, force: true });
}

async function hotReplDllSources(hotReplOutDir: string, pluginsDir: string) {
  const entries = await readdir(hotReplOutDir);
  return entries
    .filter((name) => name.endsWith(".dll"))
    .map((name) => ({
      name,
      source: join(hotReplOutDir, name),
      target: join(pluginsDir, "HotRepl", name),
    }));
}

async function requireFile(path: string): Promise<void> {
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error(`Missing deploy source: ${path}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing deploy source:")) throw error;
    throw new Error(`Missing deploy source: ${path}`, { cause: error });
  }
}

const DEFAULT_HOTREPL_PORT = 18590;
const SAFE_HOTREPL_BIND_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const REMOTE_REPL_WARNING =
  "WARNING: HotRepl has no authentication, so this non-loopback bind grants arbitrary code execution as the desktop user to any host that can reach the port. HOTREPL_BIND_HOST=127.0.0.1 is the safe loopback value.";

async function writeHotReplConfig(options: DeployOptions): Promise<void> {
  if (options.bindHost === undefined) return;
  if (!SAFE_HOTREPL_BIND_HOSTS.has(options.bindHost)) {
    if (!options.allowRemoteRepl) {
      throw new Error(
        "HotRepl has no authentication, so a non-loopback bind grants arbitrary code execution as the desktop user to any host that can reach the port. Set HOTREPL_BIND_HOST=127.0.0.1 for a loopback-only bind, or pass --allow-remote-repl for intentional remote access.",
      );
    }
    process.stdout.write(`${REMOTE_REPL_WARNING}\n`);
  }
  const configDir = join(dirname(options.pluginsDir), "config");
  await mkdir(configDir, { recursive: true });
  await writeFile(
    join(configDir, "hotrepl.bepinex.cfg"),
    `[Server]
Port = ${options.port ?? DEFAULT_HOTREPL_PORT}
BindHost = ${options.bindHost}
`,
  );
}

function parseArgs(args: string[]): DeployOptions {
  const values = new Map<string, string>();
  let allowRemoteRepl = false;
  for (let i = 0; i < args.length;) {
    const key = args[i];
    if (key === "--allow-remote-repl") {
      allowRemoteRepl = true;
      i += 1;
      continue;
    }
    const value = args[i + 1];
    if (!key?.startsWith("--") || value === undefined)
      throw new Error(`Invalid argument near ${key ?? "<end>"}`);
    values.set(key, value);
    i += 2;
  }

  const hotReplOutDir = values.get("--hotrepl-out");
  const ardenfallModOutDir = values.get("--mod-out");
  const pluginsDir = values.get("--plugins");
  const bindHost = values.get("--bind-host");
  const rawPort = values.get("--port");
  if (!hotReplOutDir) throw new Error("--hotrepl-out is required");
  if (!ardenfallModOutDir) throw new Error("--mod-out is required");
  if (!pluginsDir) throw new Error("--plugins is required");
  const options: DeployOptions = { hotReplOutDir, ardenfallModOutDir, pluginsDir, allowRemoteRepl };
  if (bindHost !== undefined) options.bindHost = bindHost;
  if (rawPort !== undefined) {
    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error(`--port must be an integer in 1-65535, got '${rawPort}'`);
    options.port = port;
  }
  return options;
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
