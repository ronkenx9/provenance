import { createPublicClient, createWalletClient, http, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantleSepolia } from "../chains.js";
import { assetIdOf, gradeBytes8 } from "./publish.js";

export const NETWORK_ABI = [
  { type: "function", name: "registry", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "MIN_STAKE", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "CHALLENGE_WINDOW", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "proposalCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "proposals", stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "id", type: "uint256" }, { name: "proposer", type: "address" },
      { name: "assetId", type: "bytes32" }, { name: "score", type: "uint16" },
      { name: "grade", type: "bytes8" }, { name: "dossierHash", type: "bytes32" },
      { name: "methodologyHash", type: "bytes32" }, { name: "yesVotes", type: "uint256" },
      { name: "noVotes", type: "uint256" }, { name: "endsAt", type: "uint64" },
      { name: "executed", type: "bool" }, { name: "disputed", type: "bool" },
      { name: "resolved", type: "bool" }, { name: "challenger", type: "address" }
    ] },
  { type: "function", name: "stakes", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "lockedStakes", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "registerOfficer", stateMutability: "payable", inputs: [], outputs: [] },
  { type: "function", name: "withdrawStake", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "proposeDossier", stateMutability: "nonpayable",
    inputs: [
      { name: "assetId", type: "bytes32" }, { name: "score", type: "uint16" },
      { name: "grade", type: "bytes8" }, { name: "dossierHash", type: "bytes32" },
      { name: "methodologyHash", type: "bytes32" }
    ], outputs: [{ name: "proposalId", type: "uint256" }] },
  { type: "function", name: "vote", stateMutability: "nonpayable", inputs: [{ name: "proposalId", type: "uint256" }, { name: "approve", type: "bool" }], outputs: [] },
  { type: "function", name: "dispute", stateMutability: "nonpayable", inputs: [{ name: "proposalId", type: "uint256" }], outputs: [] },
  { type: "function", name: "executeProposal", stateMutability: "nonpayable", inputs: [{ name: "proposalId", type: "uint256" }], outputs: [] },
  { type: "function", name: "resolveDispute", stateMutability: "nonpayable", inputs: [{ name: "proposalId", type: "uint256" }, { name: "uphold", type: "bool" }], outputs: [] },
] as const;

export interface NetworkProposal {
  id: number;
  proposer: string;
  assetId: Hex;
  score: number;
  grade: string;
  dossierHash: Hex;
  methodologyHash: Hex;
  yesVotes: number;
  noVotes: number;
  endsAt: number;
  executed: boolean;
  disputed: boolean;
  resolved: boolean;
  challenger: string;
}

export function cleanBytes8String(bytes8Hex: string): string {
  // Convert bytes8 hex back to clean string
  const cleanHex = bytes8Hex.replace(/^0x/, "").replace(/(00)+$/, "");
  return Buffer.from(cleanHex, "hex").toString("utf8");
}

export async function registerOfficerOnChain(args: {
  networkAddress: `0x${string}`; privateKey: `0x${string}`; valueEther: string; rpcUrl?: string;
}): Promise<Hex> {
  const account = privateKeyToAccount(args.privateKey);
  const transport = http(args.rpcUrl ?? mantleSepolia.rpcUrls.default.http[0]);
  const wallet = createWalletClient({ account, chain: mantleSepolia, transport });
  const publicClient = createPublicClient({ chain: mantleSepolia, transport });

  const txHash = await wallet.writeContract({
    address: args.networkAddress, abi: NETWORK_ABI, functionName: "registerOfficer",
    value: parseEther(args.valueEther)
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error(`registerOfficer tx reverted: ${txHash}`);
  return txHash;
}

export async function proposeDossierOnChain(args: {
  networkAddress: `0x${string}`; privateKey: `0x${string}`; symbol: string;
  score: number; grade: string; dossierHash: Hex; methodologyHash: Hex; rpcUrl?: string;
}): Promise<{ txHash: Hex; proposalId: number }> {
  const account = privateKeyToAccount(args.privateKey);
  const transport = http(args.rpcUrl ?? mantleSepolia.rpcUrls.default.http[0]);
  const wallet = createWalletClient({ account, chain: mantleSepolia, transport });
  const publicClient = createPublicClient({ chain: mantleSepolia, transport });

  const assetId = assetIdOf(args.symbol);
  const scoreX10 = Math.round(args.score * 10);
  const gradeB8 = gradeBytes8(args.grade);

  const txHash = await wallet.writeContract({
    address: args.networkAddress, abi: NETWORK_ABI, functionName: "proposeDossier",
    args: [assetId, scoreX10, gradeB8, args.dossierHash, args.methodologyHash]
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error(`proposeDossier tx reverted: ${txHash}`);

  // Fetch the latest proposalCount from the network
  const count = await publicClient.readContract({
    address: args.networkAddress, abi: NETWORK_ABI, functionName: "proposalCount"
  });

  return { txHash, proposalId: Number(count) };
}

export async function voteOnChain(args: {
  networkAddress: `0x${string}`; privateKey: `0x${string}`; proposalId: number; approve: boolean; rpcUrl?: string;
}): Promise<Hex> {
  const account = privateKeyToAccount(args.privateKey);
  const transport = http(args.rpcUrl ?? mantleSepolia.rpcUrls.default.http[0]);
  const wallet = createWalletClient({ account, chain: mantleSepolia, transport });
  const publicClient = createPublicClient({ chain: mantleSepolia, transport });

  const txHash = await wallet.writeContract({
    address: args.networkAddress, abi: NETWORK_ABI, functionName: "vote",
    args: [BigInt(args.proposalId), args.approve]
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error(`vote tx reverted: ${txHash}`);
  return txHash;
}

export async function disputeOnChain(args: {
  networkAddress: `0x${string}`; privateKey: `0x${string}`; proposalId: number; rpcUrl?: string;
}): Promise<Hex> {
  const account = privateKeyToAccount(args.privateKey);
  const transport = http(args.rpcUrl ?? mantleSepolia.rpcUrls.default.http[0]);
  const wallet = createWalletClient({ account, chain: mantleSepolia, transport });
  const publicClient = createPublicClient({ chain: mantleSepolia, transport });

  const txHash = await wallet.writeContract({
    address: args.networkAddress, abi: NETWORK_ABI, functionName: "dispute",
    args: [BigInt(args.proposalId)]
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error(`dispute tx reverted: ${txHash}`);
  return txHash;
}

export async function executeProposalOnChain(args: {
  networkAddress: `0x${string}`; privateKey: `0x${string}`; proposalId: number; rpcUrl?: string;
}): Promise<Hex> {
  const account = privateKeyToAccount(args.privateKey);
  const transport = http(args.rpcUrl ?? mantleSepolia.rpcUrls.default.http[0]);
  const wallet = createWalletClient({ account, chain: mantleSepolia, transport });
  const publicClient = createPublicClient({ chain: mantleSepolia, transport });

  const txHash = await wallet.writeContract({
    address: args.networkAddress, abi: NETWORK_ABI, functionName: "executeProposal",
    args: [BigInt(args.proposalId)]
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error(`executeProposal tx reverted: ${txHash}`);
  return txHash;
}

export async function resolveDisputeOnChain(args: {
  networkAddress: `0x${string}`; privateKey: `0x${string}`; proposalId: number; uphold: boolean; rpcUrl?: string;
}): Promise<Hex> {
  const account = privateKeyToAccount(args.privateKey);
  const transport = http(args.rpcUrl ?? mantleSepolia.rpcUrls.default.http[0]);
  const wallet = createWalletClient({ account, chain: mantleSepolia, transport });
  const publicClient = createPublicClient({ chain: mantleSepolia, transport });

  const txHash = await wallet.writeContract({
    address: args.networkAddress, abi: NETWORK_ABI, functionName: "resolveDispute",
    args: [BigInt(args.proposalId), args.uphold]
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error(`resolveDispute tx reverted: ${txHash}`);
  return txHash;
}

export async function fetchProposals(args: {
  networkAddress: `0x${string}`; rpcUrl?: string;
}): Promise<NetworkProposal[]> {
  const transport = http(args.rpcUrl ?? mantleSepolia.rpcUrls.default.http[0]);
  const publicClient = createPublicClient({ chain: mantleSepolia, transport });

  const count = await publicClient.readContract({
    address: args.networkAddress, abi: NETWORK_ABI, functionName: "proposalCount"
  });

  const list: NetworkProposal[] = [];
  for (let i = 1; i <= Number(count); i++) {
    const raw = await publicClient.readContract({
      address: args.networkAddress, abi: NETWORK_ABI, functionName: "proposals", args: [BigInt(i)]
    });
    list.push({
      id: Number(raw[0]),
      proposer: raw[1],
      assetId: raw[2],
      score: Number(raw[3]) / 10,
      grade: cleanBytes8String(raw[4]),
      dossierHash: raw[5],
      methodologyHash: raw[6],
      yesVotes: Number(raw[7]),
      noVotes: Number(raw[8]),
      endsAt: Number(raw[9]),
      executed: raw[10],
      disputed: raw[11],
      resolved: raw[12],
      challenger: raw[13]
    });
  }
  return list;
}
