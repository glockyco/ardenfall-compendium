#!/usr/bin/env bun
import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

const ITEM_TYPES = [
  "Ardenfall.Item.ItemData",
  "Ardenfall.Item.EquipItemData",
  "Ardenfall.Item.HandItemData",
  "Ardenfall.Item.PrimaryHandItemData",
  "Ardenfall.Item.MeleeItemData",
  "Ardenfall.Item.ArmorItemData",
  "Ardenfall.Item.ArrowItemData",
  "Ardenfall.Item.BowItemData",
  "Ardenfall.Item.SlateSpellItemData",
  "Ardenfall.Item.ThrowingItemData",
  "Ardenfall.Item.ThrowingPotionData",
  "Ardenfall.Item.ConsumableItemData",
  "Ardenfall.Item.CurrencyItemData",
  "Ardenfall.Item.LockpickItemData",
  "Ardenfall.Item.NoteItemData",
  "Ardenfall.Item.PotionRecipeItemData",
  "Ardenfall.Item.RepairKitItemData",
];

const NESTED_TYPES = [
  "Ardenfall.LeveledStatusEffect",
  "Ardenfall.StatusEffectData",
  "Ardenfall.ProjectileSettings",
  "Ardenfall.Item.NoteItem",
  "Ardenfall.Item.PotionRecipe",
  "Ardenfall.Item.RecipeItem",
  "Ardenfall.LeveledSpellData",
  "Ardenfall.SpellData",
];

const BEHAVIOR_TYPES = [
  "Ardenfall.Item.ThrowingPotionData",
  "Ardenfall.Item.PotionRecipe",
  "Ardenfall.Item.PotionRecipeItemData",
  "Ardenfall.LeveledSpellData",
];

type ParsedArgs = {
  assembly: string;
  gameVersion: string;
  outRoot: string;
  fullIl: boolean;
  allowExternalOutput: boolean;
};

type ParsedArgsState = Omit<ParsedArgs, "gameVersion"> & {
  gameVersion: string | undefined;
};

type DefaultOptionsInput = {
  assembly: string;
  gameVersion: string;
  sha256: string;
  repoRoot: string;
  outRoot?: string;
  fullIl?: boolean;
};

type DecompileOptions = {
  assembly: string;
  gameVersion: string;
  sha256: string;
  repoRoot: string;
  outRoot: string;
  outputDir: string;
  fullIl: boolean;
};

type DecompileCommand = {
  name: string;
  args: string[];
  stdoutPath: string | null;
  allowFailure?: boolean;
};

type DecompilePlan = DecompileOptions & {
  commands: DecompileCommand[];
};

type CommandResult = {
  name: string;
  args: string[];
  stdoutPath: string | null;
  stdoutBytes: number;
  exitCode: number;
  allowFailure: boolean;
};

function parseArgs(argv: string[] = Bun.argv.slice(2)): ParsedArgs {
  const parsed: ParsedArgsState = {
    assembly: "mod/libs/Assembly-CSharp.dll",
    gameVersion: undefined,
    outRoot: ".decompiled",
    fullIl: false,
    allowExternalOutput: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--full-il") {
      parsed.fullIl = true;
      continue;
    }
    if (arg === "--allow-external-output") {
      parsed.allowExternalOutput = true;
      continue;
    }
    if (arg === "--assembly" || arg === "--game-version" || arg === "--out-root") {
      const value = argv[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      if (arg === "--assembly") parsed.assembly = value;
      if (arg === "--game-version") parsed.gameVersion = value;
      if (arg === "--out-root") parsed.outRoot = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  const gameVersion = parsed.gameVersion;
  if (!gameVersion) throw new Error("--game-version is required");
  return { ...parsed, gameVersion };
}

async function sha256File(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(await Bun.file(path).arrayBuffer());
  return hasher.digest("hex");
}

async function repoRoot(): Promise<string> {
  const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"], { stdout: "pipe" });
  const out = (await new Response(proc.stdout).text()).trim();
  const code = await proc.exited;
  if (code !== 0 || out.length === 0) throw new Error("Unable to determine git repository root");
  return out;
}

function defaultOptions({
  assembly,
  gameVersion,
  sha256,
  repoRoot,
  outRoot = ".decompiled",
  fullIl = false,
}: DefaultOptionsInput): DecompileOptions {
  const outputRoot = isAbsolute(outRoot) ? outRoot : resolve(repoRoot, outRoot);
  return {
    assembly: isAbsolute(assembly) ? assembly : resolve(repoRoot, assembly),
    gameVersion,
    sha256,
    repoRoot,
    outRoot: outputRoot,
    outputDir: resolve(outputRoot, `${gameVersion}-${sha256.slice(0, 12)}`),
    fullIl,
  };
}

function buildCommandPlan(options: DecompileOptions): DecompilePlan {
  const libsDir = resolve(options.repoRoot, "mod/libs");
  const csharpDir = resolve(options.outputDir, "csharp");
  const metaDir = resolve(options.outputDir, "meta");
  const typesDir = resolve(options.outputDir, "types");
  const ilDir = resolve(options.outputDir, "il");
  const commands: DecompileCommand[] = [
    {
      name: "ilspy project",
      args: [
        "ilspycmd",
        "--disable-updatecheck",
        "--nested-directories",
        "-p",
        "-r",
        libsDir,
        "-o",
        csharpDir,
        options.assembly,
      ],
      stdoutPath: null,
      allowFailure: true,
    },
    {
      name: "ilspy classes",
      args: ["ilspycmd", "--disable-updatecheck", "-l", "c", options.assembly],
      stdoutPath: resolve(metaDir, "classes.txt"),
    },
  ];

  for (const type of [...ITEM_TYPES, ...NESTED_TYPES]) {
    commands.push({
      name: `ilspy type ${type}`,
      args: ["ilspycmd", "--disable-updatecheck", "-t", type, options.assembly],
      stdoutPath: resolve(typesDir, `${safeTypeName(type)}.cs`),
    });
  }

  for (const type of BEHAVIOR_TYPES) {
    commands.push({
      name: `ilspy il ${type}`,
      args: ["ilspycmd", "--disable-updatecheck", "--ilcode", "-t", type, options.assembly],
      stdoutPath: resolve(ilDir, `${safeTypeName(type)}.il`),
    });
  }

  if (options.fullIl) {
    commands.push({
      name: "ikdasm full assembly",
      args: ["ikdasm", options.assembly, `-out=${resolve(ilDir, "Assembly-CSharp.il")}`],
      stdoutPath: null,
    });
  }

  return { ...options, commands };
}

function safeTypeName(type: string): string {
  return type.replaceAll(".", "_").replaceAll("+", "_");
}

function isSubpath(parent: string, child: string): boolean {
  const normalizedParent = parent.endsWith("/") ? parent : `${parent}/`;
  return child === parent || child.startsWith(normalizedParent);
}

async function assertIgnored(path: string): Promise<void> {
  const proc = Bun.spawn(["git", "check-ignore", path], { stdout: "pipe" });
  await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0)
    throw new Error(`Output path is inside the worktree but is not gitignored: ${path}`);
}

async function runCommand(command: DecompileCommand): Promise<CommandResult> {
  if (command.stdoutPath) {
    const proc = Bun.spawn(command.args, {
      stdout: "pipe",
      stderr: "inherit",
    });
    const output = await new Response(proc.stdout).arrayBuffer();
    const stdoutBytes = output.byteLength;
    await writeFile(command.stdoutPath, Buffer.from(output));
    const exitCode = await proc.exited;
    return {
      name: command.name,
      args: command.args,
      stdoutPath: command.stdoutPath,
      stdoutBytes,
      exitCode,
      allowFailure: command.allowFailure === true,
    };
  }

  const proc = Bun.spawn(command.args, {
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  return {
    name: command.name,
    args: command.args,
    stdoutPath: command.stdoutPath,
    stdoutBytes: 0,
    exitCode,
    allowFailure: command.allowFailure === true,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const root = await repoRoot();
  const assembly = isAbsolute(args.assembly) ? args.assembly : resolve(root, args.assembly);
  const hash = await sha256File(assembly);
  const options = defaultOptions({
    assembly,
    gameVersion: args.gameVersion,
    sha256: hash,
    repoRoot: root,
    outRoot: args.outRoot,
    fullIl: args.fullIl,
  });

  const defaultOutRoot = resolve(root, ".decompiled");
  if (!args.allowExternalOutput && !isSubpath(defaultOutRoot, options.outputDir)) {
    throw new Error(
      `Refusing to write outside ${defaultOutRoot}; pass --allow-external-output to override`,
    );
  }
  if (isSubpath(root, options.outputDir)) await assertIgnored(options.outputDir);

  const plan = buildCommandPlan(options);
  await rm(options.outputDir, { recursive: true, force: true });
  await mkdir(resolve(options.outputDir, "csharp"), { recursive: true });
  await mkdir(resolve(options.outputDir, "meta"), { recursive: true });
  await mkdir(resolve(options.outputDir, "types"), { recursive: true });
  await mkdir(resolve(options.outputDir, "il"), { recursive: true });

  const results: CommandResult[] = [];
  for (const command of plan.commands) {
    process.stdout.write(`$ ${command.args.join(" ")}\n`);
    const result = await runCommand(command);
    results.push(result);
    if (result.exitCode !== 0 && !result.allowFailure)
      throw new Error(`Command failed: ${command.name}`);
  }

  const manifest = {
    assembly,
    gameVersion: args.gameVersion,
    sha256: hash,
    outputDir: options.outputDir,
    generatedAt: new Date().toISOString(),
    commands: results,
  };
  await writeFile(
    resolve(options.outputDir, "meta/manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  process.stdout.write(`${options.outputDir}\n`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { BEHAVIOR_TYPES, ITEM_TYPES, NESTED_TYPES, buildCommandPlan, defaultOptions, parseArgs };
