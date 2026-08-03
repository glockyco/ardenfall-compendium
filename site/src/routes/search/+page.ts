// Search reads and updates the URL query in the browser, then loads the Pagefind index.
// The route keeps SSR and prerender so the shared shell and guidance render without JavaScript.
export const prerender = true;
export const ssr = true;
export const csr = true;
