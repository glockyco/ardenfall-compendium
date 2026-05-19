import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const [artifactManifestPath, origin = "https://ardenfall.compendiums.org"] = Bun.argv.slice(2);
if (!artifactManifestPath) {
  throw new Error("usage: smoke-production-release <artifact-manifest.json> [origin]");
}

const manifest = JSON.parse(readFileSync(artifactManifestPath, "utf8"));
const releaseRes = await fetch(`${origin}/_release.json`, {
  headers: { "cache-control": "no-cache" },
});
if (!releaseRes.ok) throw new Error(`/_release.json returned ${releaseRes.status}`);
const deployed = await releaseRes.json();
if (deployed.artifactId !== manifest.artifactId) {
  throw new Error(
    `deployed artifact mismatch: expected ${manifest.artifactId}, got ${deployed.artifactId}`,
  );
}
if (deployed.git.commit !== manifest.git.commit) {
  throw new Error(
    `deployed git commit mismatch: expected ${manifest.git.commit}, got ${deployed.git.commit}`,
  );
}

const sqliteRes = await fetch(`${origin}/data.sqlite`, {
  headers: { "cache-control": "no-cache" },
});
if (!sqliteRes.ok) throw new Error(`/data.sqlite returned ${sqliteRes.status}`);
const sqliteBytes = new Uint8Array(await sqliteRes.arrayBuffer());
const sqliteHash = createHash("sha256").update(sqliteBytes).digest("hex");
if (sqliteHash !== manifest.outputs.sqlite.sha256) {
  throw new Error(
    `deployed sqlite hash mismatch: expected ${manifest.outputs.sqlite.sha256}, got ${sqliteHash}`,
  );
}

const probe = manifest.probes.items[0];
const overview = await fetchText(`${origin}/items`);
if (!overview.includes(probe.name) || !overview.includes("/assets/")) {
  throw new Error("production overview HTML does not contain release probe content");
}
if (overview.includes("sqlite-wasm")) {
  throw new Error("production overview HTML should not be hydrated SQLite SPA output");
}
if (overview.includes("_app/immutable/entry/app")) {
  const csrOptIn = readFileSync("src/routes/items/+page.ts", "utf8");
  if (!csrOptIn.includes("export const csr = true")) {
    throw new Error("production overview hydration requires an explicit /items CSR opt-in.");
  }
}

const detail = await fetchText(`${origin}/items/${probe.id}`);
if (!detail.includes(probe.name) || !detail.includes("item-icon")) {
  throw new Error("production detail HTML does not contain release probe content");
}
if (detail.includes("_app/immutable/entry/app") || detail.includes("sqlite-wasm")) {
  throw new Error("production detail HTML should not be hydrated SQLite SPA output");
}

if (probe.displayIconHash) {
  const assetRes = await fetch(`${origin}/assets/${probe.displayIconHash}.webp`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!assetRes.ok) throw new Error(`probe asset returned ${assetRes.status}`);
  const contentType = assetRes.headers.get("content-type") ?? "";
  if (!contentType.includes("image/webp"))
    throw new Error(`probe asset content-type mismatch: ${contentType}`);
}

process.stdout.write(`production smoke passed for ${manifest.artifactId}\n`);

async function fetchText(url) {
  const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return await res.text();
}
