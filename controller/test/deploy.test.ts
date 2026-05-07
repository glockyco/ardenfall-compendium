import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "bun:test";
import { deployPlugins } from "../src/deploy";

describe("deployPlugins", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("copies HotRepl and Ardenfall runtime DLLs into plugins directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "ardenfall-deploy-"));
    roots.push(root);
    const hotrepl = join(root, "hotrepl");
    const mod = join(root, "mod");
    const plugins = join(root, "plugins");
    await mkdir(hotrepl, { recursive: true });
    await mkdir(mod, { recursive: true });
    await writeFile(join(hotrepl, "HotRepl.BepInEx.dll"), "hotrepl");
    await writeFile(join(hotrepl, "HotRepl.Core.dll"), "core");
    await writeFile(join(hotrepl, "mcs.dll"), "mcs");
    await writeFile(join(mod, "ArdenfallCompendium.dll"), "archive");

    const result = await deployPlugins({
      hotReplOutDir: hotrepl,
      ardenfallModOutDir: mod,
      pluginsDir: plugins,
    });

    expect(result.copied.sort()).toEqual(
      ["ArdenfallCompendium.dll", "HotRepl.BepInEx.dll", "HotRepl.Core.dll", "mcs.dll"].sort(),
    );
    await expect(
      readFile(join(plugins, "ArdenfallCompendium", "ArdenfallCompendium.dll"), "utf8"),
    ).resolves.toBe("archive");
    await expect(readFile(join(plugins, "HotRepl", "HotRepl.BepInEx.dll"), "utf8")).resolves.toBe(
      "hotrepl",
    );
  });

  it("writes HotRepl BepInEx bind and auth config when requested", async () => {
    const root = await mkdtemp(join(tmpdir(), "ardenfall-deploy-"));
    roots.push(root);
    const hotrepl = join(root, "hotrepl");
    const mod = join(root, "mod");
    const plugins = join(root, "BepInEx", "plugins");
    await mkdir(hotrepl, { recursive: true });
    await mkdir(mod, { recursive: true });
    await writeFile(join(hotrepl, "HotRepl.BepInEx.dll"), "hotrepl");
    await writeFile(join(hotrepl, "HotRepl.Core.dll"), "core");
    await writeFile(join(hotrepl, "mcs.dll"), "mcs");
    await writeFile(join(mod, "ArdenfallCompendium.dll"), "archive");

    await deployPlugins({
      hotReplOutDir: hotrepl,
      ardenfallModOutDir: mod,
      pluginsDir: plugins,
      bindHost: "0.0.0.0",
      controlAuthToken: "local-token",
    });

    const config = await readFile(join(root, "BepInEx", "config", "hotrepl.bepinex.cfg"), "utf8");
    expect(config).toContain("BindHost = 0.0.0.0");
    expect(config).toContain("RequireAuth = true");
    expect(config).toContain("AuthToken = local-token");
  });

  it("refuses to deploy when a required source DLL is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "ardenfall-deploy-"));
    roots.push(root);

    await expect(
      deployPlugins({
        hotReplOutDir: join(root, "missing"),
        ardenfallModOutDir: join(root, "missing-mod"),
        pluginsDir: join(root, "plugins"),
      }),
    ).rejects.toThrow(/Missing deploy source/);
  });
});
