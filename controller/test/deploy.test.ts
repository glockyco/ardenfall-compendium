import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "bun:test";
import { deployPlugins } from "../src/deploy";

describe("deployPlugins", () => {
  const roots: string[] = [];

  /** A deploy target is a game directory that already has the BepInEx loader. */
  const installLoader = async (root: string): Promise<void> => {
    await mkdir(join(root, "BepInEx", "core"), { recursive: true });
    await writeFile(join(root, "BepInEx", "core", "BepInEx.Preloader.dll"), "preloader");
  };

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("copies HotRepl and Ardenfall runtime DLLs into plugins directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "ardenfall-deploy-"));
    roots.push(root);
    await installLoader(root);
    const hotrepl = join(root, "hotrepl");
    const mod = join(root, "mod");
    const plugins = join(root, "BepInEx", "plugins");
    await mkdir(hotrepl, { recursive: true });
    await mkdir(mod, { recursive: true });
    await writeFile(join(hotrepl, "HotRepl.BepInEx.dll"), "hotrepl");
    await writeFile(join(hotrepl, "HotRepl.Core.dll"), "core");
    await writeFile(join(hotrepl, "mcs.dll"), "mcs");
    await writeFile(join(mod, "ArdenfallCompendium.dll"), "compendium");

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
    ).resolves.toBe("compendium");
    await expect(readFile(join(plugins, "HotRepl", "HotRepl.BepInEx.dll"), "utf8")).resolves.toBe(
      "hotrepl",
    );
    await expect(stat(join(plugins, "HotRepl", "Namotion.Reflection.dll"))).rejects.toThrow();
  });

  it("removes the stale pre-rename ArdenfallArchives plugin directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "ardenfall-deploy-"));
    roots.push(root);
    await installLoader(root);
    const hotrepl = join(root, "hotrepl");
    const mod = join(root, "mod");
    const plugins = join(root, "BepInEx", "plugins");
    await mkdir(hotrepl, { recursive: true });
    await mkdir(mod, { recursive: true });
    await mkdir(join(plugins, "ArdenfallArchives"), { recursive: true });
    await writeFile(join(hotrepl, "HotRepl.BepInEx.dll"), "hotrepl");
    await writeFile(join(hotrepl, "HotRepl.Core.dll"), "core");
    await writeFile(join(hotrepl, "mcs.dll"), "mcs");
    await writeFile(join(mod, "ArdenfallCompendium.dll"), "compendium");
    await writeFile(join(plugins, "ArdenfallArchives", "ArdenfallArchives.dll"), "obsolete");

    await deployPlugins({
      hotReplOutDir: hotrepl,
      ardenfallModOutDir: mod,
      pluginsDir: plugins,
    });

    await expect(stat(join(plugins, "ArdenfallArchives"))).rejects.toThrow();
  });

  it("writes a loopback HotRepl bind config without removed v1 auth settings", async () => {
    const root = await mkdtemp(join(tmpdir(), "ardenfall-deploy-"));
    roots.push(root);
    await installLoader(root);
    const hotrepl = join(root, "hotrepl");
    const mod = join(root, "mod");
    const plugins = join(root, "BepInEx", "plugins");
    await mkdir(hotrepl, { recursive: true });
    await mkdir(mod, { recursive: true });
    await writeFile(join(hotrepl, "HotRepl.BepInEx.dll"), "hotrepl");
    await writeFile(join(hotrepl, "HotRepl.Core.dll"), "core");
    await writeFile(join(hotrepl, "mcs.dll"), "mcs");
    await writeFile(join(mod, "ArdenfallCompendium.dll"), "compendium");

    await deployPlugins({
      hotReplOutDir: hotrepl,
      ardenfallModOutDir: mod,
      pluginsDir: plugins,
      bindHost: "127.0.0.1",
    });

    const config = await readFile(join(root, "BepInEx", "config", "hotrepl.bepinex.cfg"), "utf8");
    expect(config).toContain("BindHost = 127.0.0.1");
    expect(config).toContain("Port = 18590");
    expect(config).not.toContain("[Control]");
    expect(config).not.toContain("RequireAuth");
    expect(config).not.toContain("AuthToken");
  });

  it("refuses a non-loopback HotRepl bind without explicit opt-in", async () => {
    const root = await mkdtemp(join(tmpdir(), "ardenfall-deploy-"));
    roots.push(root);
    await installLoader(root);
    const hotrepl = join(root, "hotrepl");
    const mod = join(root, "mod");
    const plugins = join(root, "BepInEx", "plugins");
    await mkdir(hotrepl, { recursive: true });
    await mkdir(mod, { recursive: true });
    await writeFile(join(hotrepl, "HotRepl.BepInEx.dll"), "hotrepl");
    await writeFile(join(hotrepl, "HotRepl.Core.dll"), "core");
    await writeFile(join(hotrepl, "mcs.dll"), "mcs");
    await writeFile(join(mod, "ArdenfallCompendium.dll"), "compendium");

    await expect(
      deployPlugins({
        hotReplOutDir: hotrepl,
        ardenfallModOutDir: mod,
        pluginsDir: plugins,
        bindHost: "0.0.0.0",
      }),
    ).rejects.toThrow(
      "HotRepl has no authentication, so a non-loopback bind grants arbitrary code execution as the desktop user to any host that can reach the port. Set HOTREPL_BIND_HOST=127.0.0.1 for a loopback-only bind, or pass --allow-remote-repl for intentional remote access.",
    );
    await expect(stat(join(root, "BepInEx", "config", "hotrepl.bepinex.cfg"))).rejects.toThrow();
  });

  it("writes an opted-in non-loopback bind and warns on stdout", async () => {
    const root = await mkdtemp(join(tmpdir(), "ardenfall-deploy-"));
    roots.push(root);
    await installLoader(root);
    const hotrepl = join(root, "hotrepl");
    const mod = join(root, "mod");
    const plugins = join(root, "BepInEx", "plugins");
    await mkdir(hotrepl, { recursive: true });
    await mkdir(mod, { recursive: true });
    await writeFile(join(hotrepl, "HotRepl.BepInEx.dll"), "hotrepl");
    await writeFile(join(hotrepl, "HotRepl.Core.dll"), "core");
    await writeFile(join(hotrepl, "mcs.dll"), "mcs");
    await writeFile(join(mod, "ArdenfallCompendium.dll"), "compendium");

    const writes: string[] = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    }) as typeof originalWrite;
    try {
      await deployPlugins({
        hotReplOutDir: hotrepl,
        ardenfallModOutDir: mod,
        pluginsDir: plugins,
        bindHost: "0.0.0.0",
        allowRemoteRepl: true,
      });
    } finally {
      process.stdout.write = originalWrite;
    }

    const config = await readFile(join(root, "BepInEx", "config", "hotrepl.bepinex.cfg"), "utf8");
    expect(config).toContain("BindHost = 0.0.0.0");
    expect(config).toContain("Port = 18590");
    expect(config).not.toContain("[Control]");
    expect(config).not.toContain("RequireAuth");
    expect(config).not.toContain("AuthToken");
    expect(writes.join("")).toContain("WARNING: HotRepl has no authentication");
  });

  it("writes an overridden HotRepl port so a busy default can be avoided", async () => {
    const root = await mkdtemp(join(tmpdir(), "ardenfall-deploy-"));
    roots.push(root);
    await installLoader(root);
    const hotrepl = join(root, "hotrepl");
    const mod = join(root, "mod");
    const plugins = join(root, "BepInEx", "plugins");
    await mkdir(hotrepl, { recursive: true });
    await mkdir(mod, { recursive: true });
    await writeFile(join(hotrepl, "HotRepl.BepInEx.dll"), "hotrepl");
    await writeFile(join(hotrepl, "HotRepl.Core.dll"), "core");
    await writeFile(join(hotrepl, "mcs.dll"), "mcs");
    await writeFile(join(mod, "ArdenfallCompendium.dll"), "compendium");

    await deployPlugins({
      hotReplOutDir: hotrepl,
      ardenfallModOutDir: mod,
      pluginsDir: plugins,
      bindHost: "127.0.0.1",
      port: 18591,
    });

    const config = await readFile(join(root, "BepInEx", "config", "hotrepl.bepinex.cfg"), "utf8");
    expect(config).toContain("Port = 18591");
    expect(config).not.toContain("Port = 18590");
  });

  it("refuses to deploy into a game that has no BepInEx loader", async () => {
    const root = await mkdtemp(join(tmpdir(), "ardenfall-deploy-"));
    roots.push(root);
    const hotrepl = join(root, "hotrepl");
    const mod = join(root, "mod");
    await mkdir(hotrepl, { recursive: true });
    await mkdir(mod, { recursive: true });
    await writeFile(join(hotrepl, "HotRepl.BepInEx.dll"), "hotrepl");
    await writeFile(join(hotrepl, "HotRepl.Core.dll"), "core");
    await writeFile(join(hotrepl, "mcs.dll"), "mcs");
    await writeFile(join(mod, "ArdenfallCompendium.dll"), "compendium");

    await expect(
      deployPlugins({
        hotReplOutDir: hotrepl,
        ardenfallModOutDir: mod,
        pluginsDir: join(root, "BepInEx", "plugins"),
      }),
    ).rejects.toThrow(/BepInEx is not installed/);
    await expect(stat(join(root, "BepInEx", "plugins"))).rejects.toThrow();
  });

  it("refuses to deploy when a required source DLL is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "ardenfall-deploy-"));
    roots.push(root);
    await installLoader(root);

    await expect(
      deployPlugins({
        hotReplOutDir: join(root, "missing"),
        ardenfallModOutDir: join(root, "missing-mod"),
        pluginsDir: join(root, "BepInEx", "plugins"),
      }),
    ).rejects.toThrow(/Missing deploy source/);
  });
});
