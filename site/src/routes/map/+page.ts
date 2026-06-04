// The map route is the documented CSR exception: the rest of the site is
// SSR + prerender with CSR disabled, but the interactive deck.gl map needs the
// client runtime. The shell still prerenders and the build-loaded data is
// embedded for hydration.
export const prerender = true;
export const ssr = true;
export const csr = true;
