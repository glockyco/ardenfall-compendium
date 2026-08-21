{
  description = "Ardenfall Compendium extraction mod, data pipeline and website";

  inputs = {
    # Same nixpkgs release the workstation pins, so the dev shell and the host
    # system share one evaluated package set and one binary cache.
    nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0.2605";

    # Defines the OpenSpec artifact check every repository on this workstation
    # runs, so the commands and the pinned CLI live in one place.
    fleet = {
      url = "github:glockyco/omp-agent-setup";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      fleet,
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
          }
        );
    in
    {
      devShells = forAllSystems (
        { pkgs }:
        let
          dotnetSdk = pkgs.dotnetCorePackages.sdk_10_0-bin;
          ilspycmd = pkgs.buildDotnetGlobalTool {
            pname = "ilspycmd";
            version = "11.0.0.9375";
            # The global-tool builder otherwise keeps its source-built SDK 8
            # default as the runtime even when dotnet-sdk is overridden.
            dotnet-sdk = dotnetSdk;
            dotnet-runtime = dotnetSdk;
            nugetHash = "sha256-j1VbP8qQodelkFDXhTnGne7arUIXVr1P5HjRNb2sLeo=";
          };
        in
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
              dotnetSdk

              # `bun run decompile:game` shells out to ilspycmd to refresh the
              # gitignored .decompiled/ cache that grounds game-logic decisions.
              # Package the official .NET 10 global tool because nixpkgs still
              # ships ILSpy 9.1.
              ilspycmd

              # `bun run bepinex:install` unpacks the pinned loader archive.
              pkgs.unzip

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
          openspec = fleet.lib.openspecCheck { inherit pkgs; src = ./.; };
          devShell = self.devShells.${pkgs.stdenv.hostPlatform.system}.default;
        }
      );
    };
}
