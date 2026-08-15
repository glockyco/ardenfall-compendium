#!/usr/bin/env bun
/**
 * Installs the BepInEx loader into an Ardenfall install.
 *
 * `hotrepl:setup` copies the HotRepl host and this repository's plugin into
 * `<game>/BepInEx/plugins`, but nothing created that directory, so a fresh game
 * install could not run the extraction mod and the failure looked like a HotRepl
 * connection problem rather than a missing loader.
 */
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

/**
 * Ardenfall ships as a Windows x64 Mono build, and CrossOver runs that build
 * through Wine, so the Windows loader is the correct one. The macOS asset
 * targets Unity games built for macOS.
 *
 * `sha256` is the digest the GitHub release API publishes for this asset.
 */
const RELEASE = {
  version: "5.4.23.5",
  asset: "BepInEx_win_x64_5.4.23.5.zip",
  sha256: "82f9878551030f54657792c0740d9d51a09500eeae1fba21106b0c441e6732c4",
} as const;

const CROSSOVER_WINE = "/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine";

/**
 * Wine resolves `winhttp` to its own builtin before it looks in the game
 * directory, so the Doorstop proxy that BepInEx installs there is ignored until
 * an override prefers the native copy. Without this the game starts cleanly and
 * silently loads no plugins.
 */
const DOORSTOP_PROXY = "winhttp";

type Args = { gameDir: string };

function parseArgs(argv: string[] = Bun.argv.slice(2)): Args {
  let gameDir: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--game") {
      const value = argv[++index];
      if (!value) throw new Error("--game requires a value");
      gameDir = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!gameDir) throw new Error("--game <dir> is required");
  return { gameDir: resolve(gameDir) };
}

async function assertGameDir(gameDir: string): Promise<void> {
  const markers = ["Ardenfall.exe", join("Ardenfall_Data", "Managed", "Assembly-CSharp.dll")];
  for (const marker of markers) {
    if (!(await Bun.file(join(gameDir, marker)).exists())) {
      throw new Error(`Not an Ardenfall install, missing ${marker}: ${gameDir}`);
    }
  }
}

async function downloadRelease(into: string): Promise<string> {
  const url = `https://github.com/BepInEx/BepInEx/releases/download/v${RELEASE.version}/${RELEASE.asset}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed with ${response.status}: ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== RELEASE.sha256) {
    throw new Error(
      `Digest mismatch for ${RELEASE.asset}: expected ${RELEASE.sha256}, got ${digest}`,
    );
  }
  const archive = join(into, RELEASE.asset);
  await Bun.write(archive, bytes);
  return archive;
}

async function run(args: string[]): Promise<{ exitCode: number; stdout: string }> {
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  return { exitCode: await proc.exited, stdout };
}

async function extract(archive: string, gameDir: string): Promise<void> {
  // The archive holds the loader and an empty plugins directory. It carries no
  // config file, so an existing hotrepl.bepinex.cfg survives a reinstall.
  const { exitCode } = await run(["unzip", "-o", "-q", archive, "-d", gameDir]);
  if (exitCode !== 0) throw new Error(`unzip failed with exit code ${exitCode}`);

  const installed = ["winhttp.dll", join("BepInEx", "core", "BepInEx.Preloader.dll")];
  for (const path of installed) {
    if (!(await Bun.file(join(gameDir, path)).exists())) {
      throw new Error(`BepInEx archive did not provide ${path}`);
    }
  }
}

/**
 * Returns the CrossOver bottle that holds this path, or null when the game does
 * not live in one.
 */
function crossoverBottle(gameDir: string): string | null {
  const segments = gameDir.split(sep);
  const bottles = segments.lastIndexOf("Bottles");
  if (bottles === -1) return null;
  if (segments[bottles - 1] !== "CrossOver") return null;
  return segments[bottles + 1] ?? null;
}

async function ensureWineOverride(bottle: string): Promise<void> {
  if (!(await Bun.file(CROSSOVER_WINE).exists())) {
    throw new Error(
      `CrossOver bottle ${bottle} needs a Wine override, but ${CROSSOVER_WINE} is absent`,
    );
  }
  const key = "HKCU\\Software\\Wine\\DllOverrides";
  const add = await run([
    CROSSOVER_WINE,
    "--bottle",
    bottle,
    "reg",
    "add",
    key,
    "/v",
    DOORSTOP_PROXY,
    "/t",
    "REG_SZ",
    "/d",
    "native,builtin",
    "/f",
  ]);
  if (add.exitCode !== 0) {
    throw new Error(`Failed to set the ${DOORSTOP_PROXY} override in bottle ${bottle}`);
  }
  const query = await run([
    CROSSOVER_WINE,
    "--bottle",
    bottle,
    "reg",
    "query",
    key,
    "/v",
    DOORSTOP_PROXY,
  ]);
  if (!query.stdout.includes("native,builtin")) {
    throw new Error(`The ${DOORSTOP_PROXY} override did not stick in bottle ${bottle}`);
  }
}

async function main(): Promise<void> {
  const { gameDir } = parseArgs();
  await assertGameDir(gameDir);

  const staging = await mkdtemp(join(tmpdir(), "ardenfall-bepinex-"));
  try {
    const archive = await downloadRelease(staging);
    await extract(archive, gameDir);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  process.stdout.write(`installed BepInEx ${RELEASE.version} into ${gameDir}\n`);

  const bottle = crossoverBottle(gameDir);
  if (bottle === null) {
    process.stdout.write("game is not in a CrossOver bottle, so no Wine override is needed\n");
    return;
  }
  await ensureWineOverride(bottle);
  process.stdout.write(`set ${DOORSTOP_PROXY}=native,builtin in CrossOver bottle ${bottle}\n`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { RELEASE, crossoverBottle, parseArgs };
