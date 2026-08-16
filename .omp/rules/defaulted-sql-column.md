---
name: defaulted-sql-column
description: Interrupt defaulted SQL columns that invent unmeasured values.
condition: ['(?i)\bNOT\s+NULL\s+DEFAULT\b']
globs: ["pipeline/src/sql/**/*.{ts,sql}"]
scope: "tool"
interruptMode: always
---

Measure a value before you add a `NOT NULL DEFAULT` column.
Store measured provenance or reference data, and fail when it is missing instead of inventing a default.
This rule follows the identity slice, where an unmeasured default hid missing export data and forced repeated work.
