// SQLite-driven data is queried in-browser via @sqlite.org/sqlite-wasm
// (sqlite3InitModule loads the .wasm at runtime). Server-side rendering would
// fail at module load. The site ships as an SPA hydrated against
// `static/data.sqlite`; adapter-static emits a single `index.html` fallback
// per the kit config in svelte.config.js.
export const ssr = false;
export const prerender = false;
