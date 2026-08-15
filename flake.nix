{
  description = "Ardenfall Compendium extraction mod, data pipeline and website";

  inputs = {
    # Same nixpkgs release the workstation pins, so the dev shell and the host
    # system share one evaluated package set and one binary cache.
    nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0.2605";

    # ilspycmd only. On aarch64-darwin the 26.05 build compiles ILSpy against
    # dotnetCorePackages.sdk_8_0, which is the .NET VMR source build and pulls a
    # from-source Swift toolchain with it. Unstable ships the same ilspycmd 9.1
    # prebuilt, so the decompiler costs a 30 MiB fetch instead of a multi-hour
    # rebuild. Everything else comes from the pinned release above.
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    {
      self,
      nixpkgs,
      nixpkgs-unstable,
    }:
    let
      # The mod only builds against a local game install, which is macOS here,
      # but the pipeline, controller and site jobs in CI run on Linux.
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];

      forAllSystems =
        f:
        nixpkgs.lib.genAttrs systems (
          system:
          f {
            pkgs = nixpkgs.legacyPackages.${system};
            unstable = nixpkgs-unstable.legacyPackages.${system};
          }
        );
    in
    {
      devShells = forAllSystems (
        { pkgs, unstable }:
        {
          default = pkgs.mkShellNoCC {
            packages = [
              # Every workspace script runs under Bun. package.json requires
              # >=1.3.13, this release ships 1.3.13, and
              # .github/workflows/ci.yml pins 1.3.14. Keep the three in step
              # when any of them moves.
              pkgs.bun

              # `vite build` spawns Node, so SvelteKit prerendering loads the
              # better-sqlite3 branch of site/src/lib/server/db.ts there rather
              # than the bun:sqlite one, and the pagefind CLI is an npm package
              # that runs under Node as well. CI inherits Node from the runner
              # image; a dev shell has to supply it.
              pkgs.nodejs_24

              # mod-tests targets net10.0 and mod targets netstandard2.1. This
              # is Microsoft's published SDK, the same build that CI's
              # actions/setup-dotnet installs for `dotnet format`. The
              # non-`-bin` attribute is the .NET VMR source build, which on
              # darwin also rebuilds Swift.
              pkgs.dotnetCorePackages.sdk_10_0-bin

              # `bun run decompile:game` shells out to ilspycmd to refresh the
              # gitignored .decompiled/ cache that grounds game-logic decisions.
              unstable.ilspycmd

              # Ad-hoc inspection of an emitted data.sqlite.
              pkgs.sqlite
            ];

            env = {
              DOTNET_CLI_TELEMETRY_OPTOUT = "1";
              DOTNET_NOLOGO = "1";
            };
          };
        }
      );

      formatter = forAllSystems ({ pkgs, ... }: pkgs.nixfmt-tree);

      checks = forAllSystems (
        { pkgs, ... }:
        {
          devShell = self.devShells.${pkgs.stdenv.hostPlatform.system}.default;
        }
      );
    };
}
