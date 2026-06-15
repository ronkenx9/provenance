/**
 * PROVENANCE MCP Server — exposes risk ratings to Claude Code / any MCP client.
 * Read Tools: PROVENANCE_LIST, PROVENANCE_GET_RATING, PROVENANCE_EXPLAIN
 * Write Tools (Contributors): PROVENANCE_REGISTER_OFFICER, PROVENANCE_SUBMIT_PROPOSAL,
 *                             PROVENANCE_VOTE, PROVENANCE_DISPUTE, PROVENANCE_EXECUTE
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
import {
  registerOfficerOnChain,
  proposeDossierOnChain,
  voteOnChain,
  disputeOnChain,
  executeProposalOnChain,
  resolveDisputeOnChain
} from "./anchor/network.js";
import { sha256Hex, methodologyHash } from "./anchor/publish.js";

const SNAP_DIR = join(process.cwd(), "data", "snapshots");

function loadFullDossier(assetId: string): { dossier: Dossier; symbol: string; narrative: string | null; jsonStr: string } {
  const doc = loadAssetDoc(assetId);
  const snapFile = join(SNAP_DIR, `${assetId}.json`);
  if (!existsSync(snapFile)) throw new Error(`No snapshot for ${assetId}`);
  const snap: ProbeResult = JSON.parse(readFileSync(snapFile, "utf8"));
  const { inputs, notes } = toRubricInputs(doc, toProbeData(snap));
  const dossier = buildDossier(inputs);
  const narrative = loadPregenerated(assetId);
  
  const jsonStr = JSON.stringify({ symbol: doc.symbol, address: doc.address, dossier, narrative, notes }, null, 2);
  return { dossier, symbol: doc.symbol, narrative, jsonStr };
}

function getEnvCredentials() {
  const networkAddress = process.env.NETWORK_ADDRESS;
  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  if (!networkAddress || !privateKey) {
    throw new Error("Missing NETWORK_ADDRESS or PRIVATE_KEY in environment variables (.env). Ensure these are set for write transactions.");
  }
  return { networkAddress, privateKey };
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
    {
      name: "PROVENANCE_REGISTER_OFFICER",
      description: "Register as an Officer in the decentralized underwriting network by staking ETH. Requires PRIVATE_KEY and NETWORK_ADDRESS to be set.",
      inputSchema: {
        type: "object" as const,
        properties: { valueEther: { type: "string", description: "Amount of ETH to stake (minimum '0.01')", default: "0.01" } },
        required: ["valueEther"],
      },
    },
    {
      name: "PROVENANCE_SUBMIT_PROPOSAL",
      description: "Compute and propose a new risk dossier for an asset to the network. Automatically hashes files, computes scores, locks stake, and submits proposal.",
      inputSchema: {
        type: "object" as const,
        properties: { asset: { type: "string", description: "Asset symbol: USDY, mETH, USDe, or FBTC", enum: ["USDY", "mETH", "USDe", "FBTC"] } },
        required: ["asset"],
      },
    },
    {
      name: "PROVENANCE_VOTE",
      description: "Cast a vote on an active proposal in the network. Proposer cannot vote on their own proposal.",
      inputSchema: {
        type: "object" as const,
        properties: {
          proposalId: { type: "number", description: "The proposal ID on the network" },
          approve: { type: "boolean", description: "True to approve (YES vote), false to reject (NO vote)" }
        },
        required: ["proposalId", "approve"],
      },
    },
    {
      name: "PROVENANCE_DISPUTE",
      description: "File a formal dispute/challenge against an active proposal, locking a challenge bond. If you win, you earn the proposer's stake; if you lose, you are slashed.",
      inputSchema: {
        type: "object" as const,
        properties: { proposalId: { type: "number", description: "The proposal ID to dispute" } },
        required: ["proposalId"],
      },
    },
    {
      name: "PROVENANCE_EXECUTE",
      description: "Execute a proposal after its challenge window has expired. Commits successful ratings to DossierRegistry or rejects soft proposals.",
      inputSchema: {
        type: "object" as const,
        properties: { proposalId: { type: "number", description: "The proposal ID to execute" } },
        required: ["proposalId"],
      },
    },
    {
      name: "PROVENANCE_RESOLVE_DISPUTE",
      description: "Admin/arbitrator command to resolve a disputed proposal. Slashes the losing party and rewards the winner.",
      inputSchema: {
        type: "object" as const,
        properties: {
          proposalId: { type: "number", description: "The disputed proposal ID" },
          uphold: { type: "boolean", description: "True to uphold the dispute (slash proposer), false to dismiss (slash challenger and execute)" }
        },
        required: ["proposalId", "uphold"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
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

    // Write Tools for Contributors
    if (name === "PROVENANCE_REGISTER_OFFICER") {
      const { networkAddress, privateKey } = getEnvCredentials();
      const valueEther = (args as { valueEther: string }).valueEther;
      const txHash = await registerOfficerOnChain({
        networkAddress: networkAddress as `0x${string}`,
        privateKey,
        valueEther
      });
      return { content: [{ type: "text", text: `Successfully registered as Officer! Staked ${valueEther} ETH.\nTx Hash: ${txHash}` }] };
    }

    if (name === "PROVENANCE_SUBMIT_PROPOSAL") {
      const { networkAddress, privateKey } = getEnvCredentials();
      const symbol = (args as { asset: string }).asset;
      const id = symbol.toLowerCase();
      if (!ASSET_IDS.includes(id as any)) return { content: [{ type: "text", text: `Unknown asset: ${symbol}` }], isError: true };
      
      const { dossier, jsonStr } = loadFullDossier(id);
      const dHash = sha256Hex(jsonStr);
      const mHash = methodologyHash();

      const { txHash, proposalId } = await proposeDossierOnChain({
        networkAddress: networkAddress as `0x${string}`,
        privateKey,
        symbol,
        score: dossier.composite,
        grade: dossier.grade,
        dossierHash: dHash,
        methodologyHash: mHash
      });
      return { content: [{ type: "text", text: `Successfully proposed rating for ${symbol}!\nProposal ID: ${proposalId}\nProposed Score: ${dossier.composite} (${dossier.grade})\nTx Hash: ${txHash}` }] };
    }

    if (name === "PROVENANCE_VOTE") {
      const { networkAddress, privateKey } = getEnvCredentials();
      const pId = (args as { proposalId: number }).proposalId;
      const approve = (args as { approve: boolean }).approve;
      const txHash = await voteOnChain({
        networkAddress: networkAddress as `0x${string}`,
        privateKey,
        proposalId: pId,
        approve
      });
      return { content: [{ type: "text", text: `Vote successfully cast on Proposal #${pId}!\nVote: ${approve ? "APPROVE" : "REJECT"}\nTx Hash: ${txHash}` }] };
    }

    if (name === "PROVENANCE_DISPUTE") {
      const { networkAddress, privateKey } = getEnvCredentials();
      const pId = (args as { proposalId: number }).proposalId;
      const txHash = await disputeOnChain({
        networkAddress: networkAddress as `0x${string}`,
        privateKey,
        proposalId: pId
      });
      return { content: [{ type: "text", text: `Dispute successfully registered for Proposal #${pId}! Staked challenge bond.\nTx Hash: ${txHash}` }] };
    }

    if (name === "PROVENANCE_EXECUTE") {
      const { networkAddress, privateKey } = getEnvCredentials();
      const pId = (args as { proposalId: number }).proposalId;
      const txHash = await executeProposalOnChain({
        networkAddress: networkAddress as `0x${string}`,
        privateKey,
        proposalId: pId
      });
      return { content: [{ type: "text", text: `Proposal #${pId} executed successfully!\nTx Hash: ${txHash}` }] };
    }

    if (name === "PROVENANCE_RESOLVE_DISPUTE") {
      const { networkAddress, privateKey } = getEnvCredentials();
      const pId = (args as { proposalId: number }).proposalId;
      const uphold = (args as { uphold: boolean }).uphold;
      const txHash = await resolveDisputeOnChain({
        networkAddress: networkAddress as `0x${string}`,
        privateKey,
        proposalId: pId,
        uphold
      });
      return { content: [{ type: "text", text: `Dispute resolved successfully!\nUphold Dispute: ${uphold}\nTx Hash: ${txHash}` }] };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  } catch (err: any) {
    return { content: [{ type: "text", text: `Error executing tool: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
