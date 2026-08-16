---
name: source-text-test
description: Interrupt tests and smokes that assert on component, module, or configuration source.
condition:
  [
    '(?i)(?![\s\S]*\bpolicy\s+check\b)(?:readFileSync|readFile|read_text|fs\.readFile)\s*\([\s\S]{0,400}?(?:\.svelte\b|\.tsx?\b|(?:^|[/\\])[^/\x27"\\]*config[^/\x27"\\]*\.[a-z0-9]+|(?:^|[/\\])(?:package|tsconfig|vite|wrangler|prettier|eslint|lefthook)\.[a-z0-9]+)[\s\S]{0,5000}?\b(?:expect|assert|toContain|toMatch|toEqual|toBe|includes|startsWith|endsWith)\b',
  ]
globs:
  [
    "**/*.test.*",
    "**/*.spec.*",
    "**/*smoke*.*",
    "**/*probe*.*",
    "**/test/**",
    "**/tests/**",
    "**/smoke/**",
    "**/smokes/**",
  ]
scope: "tool"
interruptMode: always
---

Test the rendered page, built artifact, or running process instead of reading source text.
If the test checks a policy about source, write `policy check` in its test comment and assert that policy deliberately.
This rule follows `tooling.test.ts`, where the source assertion declares its policy purpose and protects the smoke-selection contract.
