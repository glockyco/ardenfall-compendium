---
name: no-verify-commit
description: Prevent commits that bypass repository hooks.
condition: ['(?i)\bgit\b[\s\S]*\bcommit\b[\s\S]*--no-verify\b']
globs: ["**/*"]
scope: "tool"
interruptMode: always
---

Run the commit with hooks enabled, and fix the hook failure instead of adding `--no-verify`.
This rule follows the hook bypass that allowed unchecked work to enter a commit and forced a later repair.
