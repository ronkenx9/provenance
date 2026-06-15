/**
 * PROVENANCE REST API — minimal node:http server.
 * GET /rating/:asset   → full dossier JSON
 * GET /ratings         → all assets summary
 * GET /narrative/:asset → plain-English narrative
 */
import "dotenv/config";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ASSET_IDS, loadAssetDoc, toRubricInputs } from "./corpus/load.js";
import { buildDossier } from "./rubric/score.js";
import { toProbeData, type ProbeResult } from "./probes/asset-probe.js";
import { loadPregenerated } from "./narrative/generate.js";
import { fetchProposals } from "./anchor/network.js";

const PORT = Number(process.env.PORT) || 3000;
const SNAP_DIR = join(process.cwd(), "data", "snapshots");

function loadDossier(assetId: string) {
  const doc = loadAssetDoc(assetId);
  const snapFile = join(SNAP_DIR, `${assetId}.json`);
  if (!existsSync(snapFile)) throw new Error(`No snapshot for ${assetId}`);
  const snap: ProbeResult = JSON.parse(readFileSync(snapFile, "utf8"));
  const { inputs, notes } = toRubricInputs(doc, toProbeData(snap));
  const dossier = buildDossier(inputs);
  const narrative = loadPregenerated(assetId);
  return { symbol: doc.symbol, address: doc.address, dossier, narrative, notes };
}

function json(res: any, status: number, data: unknown) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
  });
  res.end(JSON.stringify(data, null, 2));
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "OPTIONS") { json(res, 204, null); return; }

  if (url.pathname === "/ratings" || url.pathname === "/ratings/") {
    const list = ASSET_IDS.map((id) => {
      const { symbol, dossier } = loadDossier(id);
      return {
        assetId: id, symbol, composite: dossier.composite, grade: dossier.grade,
        flags: dossier.flags, dimensions: dossier.dimensions.map((d) => ({
          dimension: d.dimension, score: d.score, unknown: d.unknown, effectiveWeight: d.effectiveWeight,
        })),
      };
    });
    const firstDossier = ASSET_IDS.length ? loadDossier(ASSET_IDS[0]).dossier : null;
    json(res, 200, { rubricVersion: firstDossier?.rubricVersion ?? "1.0.0", assets: list });
    return;
  }

  const ratingMatch = url.pathname.match(/^\/rating\/(\w+)$/);
  if (ratingMatch) {
    const id = ratingMatch[1].toLowerCase();
    if (!ASSET_IDS.includes(id as any)) { json(res, 404, { error: `Unknown asset: ${id}`, available: [...ASSET_IDS] }); return; }
    const { symbol, address, dossier, narrative, notes } = loadDossier(id);
    json(res, 200, {
      assetId: id, symbol, address, ...dossier, narrative,
      registry: process.env.REGISTRY_ADDRESS ?? null,
      explorerUrl: process.env.REGISTRY_ADDRESS ? `https://explorer.sepolia.mantle.xyz/address/${process.env.REGISTRY_ADDRESS}` : null,
    });
    return;
  }

  const narrativeMatch = url.pathname.match(/^\/narrative\/(\w+)$/);
  if (narrativeMatch) {
    const id = narrativeMatch[1].toLowerCase();
    if (!ASSET_IDS.includes(id as any)) { json(res, 404, { error: `Unknown asset: ${id}` }); return; }
    const { narrative } = loadDossier(id);
    json(res, 200, { assetId: id, narrative: narrative ?? "No narrative available." });
    return;
  }

  const proposalsMatch = url.pathname.match(/^\/network\/proposals$/);
  if (proposalsMatch) {
    const netAddr = process.env.NETWORK_ADDRESS;
    if (!netAddr) { json(res, 400, { error: "NETWORK_ADDRESS not configured in environment" }); return; }
    fetchProposals({ networkAddress: netAddr as `0x${string}` })
      .then((proposals) => json(res, 200, { proposals }))
      .catch((err) => json(res, 500, { error: err.message }));
    return;
  }

  const proposalMatch = url.pathname.match(/^\/network\/proposal\/(\d+)$/);
  if (proposalMatch) {
    const id = Number(proposalMatch[1]);
    const netAddr = process.env.NETWORK_ADDRESS;
    if (!netAddr) { json(res, 400, { error: "NETWORK_ADDRESS not configured in environment" }); return; }
    fetchProposals({ networkAddress: netAddr as `0x${string}` })
      .then((proposals) => {
        const found = proposals.find((p) => p.id === id);
        if (!found) { json(res, 404, { error: `Proposal not found: ${id}` }); }
        else { json(res, 200, found); }
      })
      .catch((err) => json(res, 500, { error: err.message }));
    return;
  }

  // Health check
  if (url.pathname === "/health") {
    json(res, 200, { status: "ok", service: "provenance", assets: ASSET_IDS.length });
    return;
  }

  // Serve frontend
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const html = readFileSync(join(process.cwd(), "frontend", "index.html"), "utf8");
    res.writeHead(200, { "content-type": "text/html", "access-control-allow-origin": "*" });
    res.end(html);
    return;
  }

  json(res, 404, {
    error: "Not found",
    routes: [
      "GET /",
      "GET /ratings",
      "GET /rating/:asset",
      "GET /narrative/:asset",
      "GET /network/proposals",
      "GET /network/proposal/:id"
    ]
  });
});

server.listen(PORT, () => { console.log(`PROVENANCE API listening on http://localhost:${PORT}`); });
