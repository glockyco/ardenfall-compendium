import type { ClassValue } from "tailwind-variants";

/** Concatenate class values; undefined/false drop out. */
export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat()
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ");
}
