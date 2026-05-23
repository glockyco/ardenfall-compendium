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
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // shadcn-svelte primitives accept arbitrary user-supplied href values
    // (internal, external, mailto:, hash). resolve() is a routing-tree helper
    // and would break the wrapper. The rule stays on for app routes/pages
    // where it catches real internal-link mistakes.
    files: ["site/src/lib/components/ui/**/*.svelte"],
    rules: {
      "svelte/no-navigation-without-resolve": "off",
    },
  },
);
