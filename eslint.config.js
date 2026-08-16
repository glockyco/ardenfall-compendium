import js from "@eslint/js";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import svelteConfig from "./site/svelte.config.js";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      ".worktrees/",
      "worktrees/",
      "**/.svelte-kit/",
      "site/build/",
      "pipeline/dist/",
      "mod/bin/",
      "mod/obj/",
      "mod/libs/",
      "snapshots/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        projectService: true,
        extraFileExtensions: [".svelte"],
        svelteConfig,
      },
    },
  },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.bunBuiltin },
    },
  },
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    // The `svelte/no-navigation-without-resolve` rule has known false positives on
    // dynamic `<a href>` values driven by typed data, including ResolvedPathname-typed
    // values, search params/hash fragments, and values read from object properties in
    // loops. The rule maintainers acknowledge these limitations and recommend
    // `ignoreLinks: true` for projects that pass generated/typed hrefs into anchors:
    //   - https://github.com/sveltejs/eslint-plugin-svelte/issues/1319
    //   - https://github.com/sveltejs/eslint-plugin-svelte/issues/1327
    //   - https://github.com/sveltejs/eslint-plugin-svelte/issues/1314
    //   - https://github.com/sveltejs/eslint-plugin-svelte/issues/1353
    //   - https://maier.tech/notes/eslint-plugin-svelte-makes-sveltekit-linter-fail
    //
    // The site reads pipeline-generated route paths from typed read models
    // (`SiteEntity.route_path`, `ItemOverviewRow.routePath`, layout `data.itemRoute`,
    // etc.). Those paths are produced by descriptor-validated emitters; passing them
    // through `resolve()` would require unsafe type casts. The rule still applies to
    // `goto()`, `pushState()`, and `replaceState()`, where dev-authored route literals
    // benefit from the check.
    files: ["**/*.svelte", "**/*.svelte.ts"],
    rules: {
      // Rich text arrives as parsed `rich_text_v1` nodes and is rendered element by
      // element, so a component never needs raw markup. The linter owns this rather
      // than a script that greps components for the syntax.
      "svelte/no-at-html-tags": "error",
      "svelte/no-navigation-without-resolve": [
        "error",
        {
          ignoreLinks: true,
          ignoreGoto: false,
          ignorePushState: false,
          ignoreReplaceState: false,
        },
      ],
    },
  },
);
