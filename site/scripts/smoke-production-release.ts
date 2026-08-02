import { readFileSync } from "node:fs";

interface ArtifactProbe {
  id: string;
  name: string;
  displayIconHash?: string | null;
}

interface ArtifactManifest {
  artifactId: string;
  source: { snapshotManifestSha256: string };
  git: { commit: string };
  probes: { items: [ArtifactProbe, ...ArtifactProbe[]] };
}

interface DeployedRelease {
  artifactId: string;
  source: { snapshotManifestSha256: string };
  git: { commit: string };
}

const [artifactManifestPath, origin = "https://ardenfall.compendiums.org"] = Bun.argv.slice(2);
if (!artifactManifestPath) {
  throw new Error("usage: smoke-production-release <artifact-manifest.json> [origin]");
}

const parsedManifest: unknown = JSON.parse(readFileSync(artifactManifestPath, "utf8"));
if (!isArtifactManifest(parsedManifest)) {
  throw new Error("invalid artifact manifest");
}
const manifest = parsedManifest;
const releaseRes = await fetch(`${origin}/_release.json`, {
  headers: { "cache-control": "no-cache" },
});
if (!releaseRes.ok) throw new Error(`/_release.json returned ${releaseRes.status}`);
const parsedDeployed: unknown = await releaseRes.json();
if (!isDeployedRelease(parsedDeployed)) {
  throw new Error("invalid deployed release metadata");
}
const deployed = parsedDeployed;
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
if (deployed.source.snapshotManifestSha256 !== manifest.source.snapshotManifestSha256) {
  throw new Error(
    `deployed snapshot manifest mismatch: expected ${manifest.source.snapshotManifestSha256}, got ${deployed.source.snapshotManifestSha256}`,
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

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return await res.text();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isArtifactProbe(value: unknown): value is ArtifactProbe {
  if (!isRecord(value) || !isString(value.id) || !isString(value.name)) {
    return false;
  }
  const displayIconHash = value.displayIconHash;
  return displayIconHash === undefined || displayIconHash === null || isString(displayIconHash);
}

function isArtifactManifest(value: unknown): value is ArtifactManifest {
  if (!isRecord(value) || !isString(value.artifactId)) {
    return false;
  }
  const git = value.git;
  const source = value.source;
  const probes = value.probes;
  if (!isRecord(git) || !isString(git.commit)) {
    return false;
  }
  if (!isRecord(source) || !isString(source.snapshotManifestSha256)) {
    return false;
  }
  return (
    isRecord(probes) &&
    Array.isArray(probes.items) &&
    probes.items.length > 0 &&
    probes.items.every(isArtifactProbe)
  );
}

function isDeployedRelease(value: unknown): value is DeployedRelease {
  if (!isRecord(value) || !isString(value.artifactId) || !isRecord(value.git)) {
    return false;
  }
  if (!isString(value.git.commit) || !isRecord(value.source)) {
    return false;
  }
  return isString(value.source.snapshotManifestSha256);
}
