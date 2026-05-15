// Generated compendium pages are deterministic for a given snapshot. Render
// them at build time and ship static HTML by default. Re-enable CSR only for a
// route that documents a real browser-interactivity requirement.
export const ssr = true;
export const prerender = true;
export const csr = false;
