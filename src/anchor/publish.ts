/**
 * Publish path: canonical dossier JSON -> sha256 -> DossierRegistry.publishDossier.
 * methodologyHash pins weights.json + the rubric source so a scoring change is
 * publicly visible as a new methodology (never a silent edit).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, http, keccak256, stringToBytes, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantleSepolia } from "../chains.js";
import type { Dossier } from "../rubric/types.js";

export const REGISTRY_ABI = [
  { type: "function", name: "publishDossier", stateMutability: "nonpayable",
    inputs: [
      { name: "assetId", type: "bytes32" }, { name: "score", type: "uint16" },
      { name: "grade", type: "bytes8" }, { name: "dossierHash", type: "bytes32" },
      { name: "methodologyHash", type: "bytes32" },
    ], outputs: [{ name: "version", type: "uint32" }] },
  { type: "function", name: "latest", stateMutability: "view",
    inputs: [{ name: "assetId", type: "bytes32" }],
    outputs: [{ type: "tuple", components: [
      { name: "score", type: "uint16" }, { name: "grade", type: "bytes8" },
      { name: "dossierHash", type: "bytes32" }, { name: "methodologyHash", type: "bytes32" },
      { name: "atBlock", type: "uint64" }, { name: "version", type: "uint32" },
    ] }] },
] as const;

export function sha256Hex(data: string | Buffer): Hex {
  return `0x${createHash("sha256").update(data).digest("hex")}`;
}

/** Pin the methodology: weights.json + rubric source, hashed together. */
export function methodologyHash(root = process.cwd()): Hex {
  const weights = readFileSync(join(root, "src/rubric/weights.json"));
  const scorer = readFileSync(join(root, "src/rubric/score.ts"));
  return sha256Hex(Buffer.concat([weights, scorer]));
}

export function assetIdOf(symbol: string): Hex {
  return keccak256(stringToBytes(symbol));
}

export function gradeBytes8(grade: string): Hex {
  return toHex(stringToBytes(grade), { size: 8 });
}

export interface PublishResult {
  txHash: Hex; assetId: Hex; version: number;
  dossierHash: Hex; methodologyHash: Hex; verifyUrl: string;
}

export async function publishDossierOnChain(args: {
  symbol: string; dossier: Dossier; dossierJson: string;
  registry: `0x${string}`; privateKey: `0x${string}`; rpcUrl?: string;
}): Promise<PublishResult> {
  const account = privateKeyToAccount(args.privateKey);
  const transport = http(args.rpcUrl ?? mantleSepolia.rpcUrls.default.http[0]);
  const wallet = createWalletClient({ account, chain: mantleSepolia, transport });
  const publicClient = createPublicClient({ chain: mantleSepolia, transport });

  const assetId = assetIdOf(args.symbol);
  const dHash = sha256Hex(args.dossierJson);
  const mHash = methodologyHash();
  const score = Math.round(args.dossier.composite * 10);

  const txHash = await wallet.writeContract({
    address: args.registry, abi: REGISTRY_ABI, functionName: "publishDossier",
    args: [assetId, score, gradeBytes8(args.dossier.grade), dHash, mHash],
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  const latest = await publicClient.readContract({
    address: args.registry, abi: REGISTRY_ABI, functionName: "latest", args: [assetId],
  });

  return {
    txHash, assetId, version: Number(latest.version), dossierHash: dHash, methodologyHash: mHash,
    verifyUrl: `${mantleSepolia.blockExplorers!.default.url}/tx/${txHash}`,
  };
}
