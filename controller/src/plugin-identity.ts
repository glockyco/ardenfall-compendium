import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Plugin assembly the deploy step copies into the game's plugin directory. */
export const DEPLOYED_PLUGIN_RELATIVE_PATH = join("ArdenfallCompendium", "ArdenfallCompendium.dll");

export interface RunningPluginIdentity {
  path: string;
  sha256: string;
  modifiedAt: string;
}

/**
 * Digest of the plugin assembly deployed under `pluginsDir`.
 *
 * The running game reports a Windows path for the same file, so the comparison is over content
 * rather than location.
 */
export async function deployedPluginSha256(pluginsDir: string): Promise<string> {
  const path = join(pluginsDir, DEPLOYED_PLUGIN_RELATIVE_PATH);
  let bytes: Uint8Array;
  try {
    bytes = await readFile(path);
  } catch (error) {
    throw new Error(
      `Cannot read the deployed plugin at ${path}. ` + "Run `bun run hotrepl:setup` to deploy it.",
      { cause: error },
    );
  }
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

/**
 * Identity the running plugin reported through `compendium.preflight`.
 *
 * A missing field is a failure rather than a reason to skip the comparison: every build that
 * carries this check reports one, so an absent identity means the answering game runs an older
 * plugin.
 */
export function readRunningPluginIdentity(
  preflight: Record<string, unknown>,
): RunningPluginIdentity {
  const sha256 = requireField(preflight.pluginSha256, "pluginSha256");
  const path = requireField(preflight.pluginPath, "pluginPath");
  const modifiedAt = requireField(preflight.pluginModifiedAt, "pluginModifiedAt");
  return { modifiedAt, path, sha256 };
}

/**
 * Fails the export when the answering game does not run the deployed plugin.
 *
 * The Unity product name catches a different game and the port guard catches a second listener.
 * Neither can see this case, and the identity slice met it: a stale instance answered an export
 * and the snapshot lacked fields the deployed mod emits.
 */
export async function assertDeployedPluginAnswered(
  preflight: Record<string, unknown>,
  pluginsDir: string,
): Promise<RunningPluginIdentity> {
  const running = readRunningPluginIdentity(preflight);
  const deployed = await deployedPluginSha256(pluginsDir);
  if (running.sha256 !== deployed) {
    throw new Error(
      "Publication embargo: the game is not running the deployed plugin. " +
        `It answered from ${running.path} (sha256 ${running.sha256}, modified ${running.modifiedAt}), ` +
        `while ${join(pluginsDir, DEPLOYED_PLUGIN_RELATIVE_PATH)} has sha256 ${deployed}. ` +
        "Restart the game after `bun run hotrepl:setup`; a snapshot from an older plugin lacks " +
        "fields the deployed mod emits.",
    );
  }
  return running;
}

function requireField(value: unknown, field: string): string {
  if (typeof value === "string" && value.length > 0) return value;
  throw new Error(
    `Publication embargo: compendium.preflight reported no ${field}, so the plugin that answered ` +
      "cannot be proven. The game is running a plugin older than this controller expects; " +
      "restart it after `bun run hotrepl:setup`.",
  );
}
