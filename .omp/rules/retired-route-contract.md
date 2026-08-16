---
name: retired-route-contract
description: Report reintroduced route and reader-facing placeholder contracts.
condition:
  [
    '(?i)(?:\blegacy[\s_-]+route[\s_-]+table\b|_redirects\b|\bpreviousRoutes\b|\bunnamed\s+character\b)',
  ]
globs:
  [
    "pipeline/**/*.{ts,tsx,js,jsx,sql}",
    "site/**/*.{ts,tsx,js,jsx,svelte,json}",
    "entities/**/*.json",
    "mod/**/*.{cs,json}",
  ]
scope: "tool"
interruptMode: never
---

Use current canonical routes and measured reader-facing names instead of restoring a legacy route table, `previousRoutes`, or `Unnamed character`.
Keep old links on the not-found path, and derive each visible label from current entity data.
The route cutover and identity slice removed redirects and the placeholder after they hid current contracts.
