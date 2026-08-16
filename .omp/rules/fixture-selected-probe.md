---
name: fixture-selected-probe
description: Report probes and smokes that select subjects by fixture identifiers or display names.
condition:
  [
    '(?i)(?:\bfixture[-_][a-z0-9_-]+\b|\bfixture(?:id|name)\b\s*[:=]|\b(?:id|name)\b\s*===?\s*["\x27][^"\x27]+["\x27]|\b(?:where|and)\s+[a-z0-9_.]+\s*=\s*["\x27][^"\x27]+["\x27])',
  ]
globs:
  [
    "**/*smoke*.*",
    "**/*probe*.*",
    "**/*.smoke.*",
    "**/*.probe.*",
    "**/smoke/**",
    "**/smokes/**",
    "**/probe/**",
    "**/probes/**",
  ]
scope: "tool"
interruptMode: never
---

Select a probe subject by measured state, such as a non-empty field or relation, instead of a fixture id or display name.
Use the same state query for synthetic fixtures and live exports, so the smoke tests the contract rather than one dataset.
This rule follows the prerender smoke policy check, which rejects `fixture-iron-sword` and `Iron Sword` selectors.
