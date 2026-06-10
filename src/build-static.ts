/**
 * Build a self-contained static frontend by embedding all dossier data
 * directly into the HTML. No API dependency at runtime.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ASSET_IDS, loadAssetDoc, toRubricInputs } from "./corpus/load.js";
import { buildDossier } from "./rubric/score.js";
import { toProbeData, type ProbeResult } from "./probes/asset-probe.js";
import { loadPregenerated } from "./narrative/generate.js";

const SNAP_DIR = join(process.cwd(), "data", "snapshots");
const OUT_DIR = join(process.cwd(), "dist", "site");

// Build all ratings data
const ratings: Record<string, unknown> = {};
for (const id of ASSET_IDS) {
  const doc = loadAssetDoc(id);
  const snap: ProbeResult = JSON.parse(readFileSync(join(SNAP_DIR, `${id}.json`), "utf8"));
  const { inputs } = toRubricInputs(doc, toProbeData(snap));
  const dossier = buildDossier(inputs);
  const narrative = loadPregenerated(id);
  ratings[id] = {
    assetId: id, symbol: doc.symbol, address: doc.address, ...dossier, narrative,
    registry: process.env.REGISTRY_ADDRESS ?? "0xd1534d20006248f4c2c290F83e6377b4A06037A9",
    explorerUrl: `https://explorer.sepolia.mantle.xyz/address/${process.env.REGISTRY_ADDRESS ?? "0xd1534d20006248f4c2c290F83e6377b4A06037A9"}`,
  };
}

// Read the HTML template
let html = readFileSync(join(process.cwd(), "frontend", "index.html"), "utf8");

// Replace the API fetch with embedded data
const embedScript = `
<script>
// Embedded ratings data — no API dependency
const EMBEDDED_DATA = ${JSON.stringify(ratings)};
</script>`;

// Insert before the main script
html = html.replace("<script>", embedScript + "\n<script>");

// Replace the fetchRatings function to use embedded data
html = html.replace(
  /async function fetchRatings\(\) \{[\s\S]*?^  \}/m,
  `async function fetchRatings() {
  // Use embedded data (static build)
  for (const [id, data] of Object.entries(EMBEDDED_DATA || {})) {
    RATINGS_DATA[id] = data;
  }
  // Also try API for dev mode
  if (!Object.values(RATINGS_DATA).some(Boolean)) {
    try {
      for (const id of Object.keys(RATINGS_DATA)) {
        const res = await fetch(API_BASE + '/rating/' + id);
        if (res.ok) RATINGS_DATA[id] = await res.json();
      }
    } catch {}
  }
}`
);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "index.html"), html);
console.log(`Static site built to ${OUT_DIR}/index.html (${(html.length / 1024).toFixed(0)} KB)`);
