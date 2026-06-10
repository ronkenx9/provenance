/**
 * PROVENANCE MCP Server — exposes risk ratings to Claude Code / any MCP client.
 * Tools: PROVENANCE_LIST, PROVENANCE_GET_RATING, PROVENANCE_EXPLAIN
 */
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ASSET_IDS, loadAssetDoc, toRubricInputs } from "./corpus/load.js";
import { buildDossier } from "./rubric/score.js";
import { toProbeData, type ProbeResult } from "./probes/asset-probe.js";
import { loadPregenerated } from "./narrative/generate.js";
import type { Dossier } from "./rubric/types.js";

const SNAP_DIR = join(process.cwd(), "data", "snapshots");

function loadFullDossier(assetId: string): { dossier: Dossier; symbol: string; narrative: string | null } {
  const doc = loadAssetDoc(assetId);
  const snapFile = join(SNAP_DIR, `${assetId}.json`);
  if (!existsSync(snapFile)) throw new Error(`No snapshot for ${assetId}`);
  const snap: ProbeResult = JSON.parse(readFileSync(snapFile, "utf8"));
  const { inputs } = toRubricInputs(doc, toProbeData(snap));
  const dossier = buildDossier(inputs);
  const narrative = loadPregenerated(assetId);
  return { dossier, symbol: doc.symbol, narrative };
}

const server = new Server({ name: "provenance", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "PROVENANCE_LIST",
      description: "List all rated tokenized assets with their composite scores and grades.",
      inputSchema: { type: "object" as const, properties: {} },
    },
    {
      name: "PROVENANCE_GET_RATING",
      description: "Get the full risk dossier for a specific tokenized asset, including per-dimension scores, factors, and flags.",
      inputSchema: {
        type: "object" as const,
        properties: { asset: { type: "string", description: "Asset symbol: USDY, mETH, USDe, or FBTC", enum: ["USDY", "mETH", "USDe", "FBTC"] } },
        required: ["asset"],
      },
    },
    {
      name: "PROVENANCE_EXPLAIN",
      description: "Get a plain-English narrative explanation of an asset's risk rating. The narrative is LLM-generated but validated: every number matches a computed score.",
      inputSchema: {
        type: "object" as const,
        properties: { asset: { type: "string", description: "Asset symbol: USDY, mETH, USDe, or FBTC", enum: ["USDY", "mETH", "USDe", "FBTC"] } },
        required: ["asset"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === "PROVENANCE_LIST") {
    const list = ASSET_IDS.map((id) => {
      const { dossier, symbol } = loadFullDossier(id);
      return { symbol, composite: dossier.composite, grade: dossier.grade, flagCount: dossier.flags.length };
    });
    return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
  }

  if (name === "PROVENANCE_GET_RATING") {
    const symbol = (args as { asset: string }).asset;
    const id = symbol.toLowerCase();
    if (!ASSET_IDS.includes(id as any)) return { content: [{ type: "text", text: `Unknown asset: ${symbol}. Available: ${ASSET_IDS.join(", ")}` }], isError: true };
    const { dossier } = loadFullDossier(id);
    return { content: [{ type: "text", text: JSON.stringify(dossier, null, 2) }] };
  }

  if (name === "PROVENANCE_EXPLAIN") {
    const symbol = (args as { asset: string }).asset;
    const id = symbol.toLowerCase();
    if (!ASSET_IDS.includes(id as any)) return { content: [{ type: "text", text: `Unknown asset: ${symbol}. Available: ${ASSET_IDS.join(", ")}` }], isError: true };
    const { narrative, dossier } = loadFullDossier(id);
    if (!narrative) return { content: [{ type: "text", text: `No narrative available for ${symbol}. Score: ${dossier.composite} (${dossier.grade})` }] };
    return { content: [{ type: "text", text: narrative }] };
  }

  return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
});

const transport = new StdioServerTransport();
await server.connect(transport);
