import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Concatenate class values with Tailwind-aware merging.
 *
 * Used by every shadcn-svelte primitive copied into `src/lib/components/ui/`.
 * `clsx` flattens conditional class objects/arrays; `twMerge` resolves
 * conflicts between Tailwind utilities so caller-supplied classes can override
 * defaults (`cn("p-2", "p-4")` → `"p-4"`, not `"p-2 p-4"`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
/* eslint-enable @typescript-eslint/no-explicit-any */
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
