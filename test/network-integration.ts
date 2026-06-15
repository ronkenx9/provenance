import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, http, type Hex, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { localhost } from "viem/chains";
import {
  registerOfficerOnChain,
  proposeDossierOnChain,
  voteOnChain,
  executeProposalOnChain,
  fetchProposals
} from "../src/anchor/network.js";
import { sha256Hex, methodologyHash } from "../src/anchor/publish.js";

// Anvil default accounts
const KEY_OWNER = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const KEY_OFFICER_1 = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const KEY_OFFICER_2 = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

const RPC_URL = "http://127.0.0.1:8545";

async function main() {
  console.log("Starting end-to-end integration test...");

  const transport = http(RPC_URL);
  const publicClient = createPublicClient({ chain: localhost, transport });
  const ownerAccount = privateKeyToAccount(KEY_OWNER);
  const walletClient = createWalletClient({ account: ownerAccount, chain: localhost, transport });

  // Load contract compilation artifacts from Foundry out folder
  const artifactPath = join(process.cwd(), "out", "AgentUnderwriterNetwork.sol", "AgentUnderwriterNetwork.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode.object as Hex;

  console.log("Deploying AgentUnderwriterNetwork to local Anvil...");
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const networkAddress = receipt.contractAddress;
  if (!networkAddress) throw new Error("Deployment failed: no contract address");
  console.log(`AgentUnderwriterNetwork deployed at: ${networkAddress}`);

  // 1. Register Officer 1
  console.log("Registering Officer 1...");
  await registerOfficerOnChain({
    networkAddress,
    privateKey: KEY_OFFICER_1,
    valueEther: "0.05",
    rpcUrl: RPC_URL
  });
  console.log("Officer 1 registered successfully.");

  // 2. Register Officer 2
  console.log("Registering Officer 2...");
  await registerOfficerOnChain({
    networkAddress,
    privateKey: KEY_OFFICER_2,
    valueEther: "0.05",
    rpcUrl: RPC_URL
  });
  console.log("Officer 2 registered successfully.");

  // 3. Officer 1 proposes a dossier
  console.log("Officer 1 submitting proposal for USDY...");
  const dummyDossierHash = sha256Hex("dummy dossier content");
  const dummyMethodologyHash = methodologyHash();
  const { proposalId, txHash: propTx } = await proposeDossierOnChain({
    networkAddress,
    privateKey: KEY_OFFICER_1,
    symbol: "USDY",
    score: 82.5,
    grade: "A",
    dossierHash: dummyDossierHash,
    methodologyHash: dummyMethodologyHash,
    rpcUrl: RPC_URL
  });
  console.log(`Proposal submitted successfully. Proposal ID: ${proposalId}, Tx: ${propTx}`);

  // 4. Officer 2 votes YES
  console.log("Officer 2 casting YES vote...");
  await voteOnChain({
    networkAddress,
    privateKey: KEY_OFFICER_2,
    proposalId,
    approve: true,
    rpcUrl: RPC_URL
  });
  console.log("Vote cast successfully.");

  // 5. Warp time (evm_increaseTime) by 301 seconds to bypass challenge window
  console.log("Warping time beyond 5-minute challenge window...");
  await publicClient.request({
    method: "evm_increaseTime" as any,
    params: [305] as any
  });
  await publicClient.request({
    method: "evm_mine" as any,
    params: [] as any
  });

  // 6. Execute the proposal
  console.log("Executing proposal...");
  await executeProposalOnChain({
    networkAddress,
    privateKey: KEY_OWNER, // anyone can execute
    proposalId,
    rpcUrl: RPC_URL
  });
  console.log("Proposal executed successfully.");

  // 7. Verify the proposal state via fetchProposals
  console.log("Fetching proposals from network...");
  const proposals = await fetchProposals({
    networkAddress,
    rpcUrl: RPC_URL
  });

  console.log("Proposals list retrieved:");
  console.log(JSON.stringify(proposals, null, 2));

  const prop = proposals.find(p => p.id === proposalId);
  if (!prop) throw new Error("Proposal not found in list");
  if (!prop.executed) throw new Error("Proposal should be executed");
  if (prop.score !== 82.5) throw new Error(`Incorrect score: expected 82.5, got ${prop.score}`);
  if (prop.grade !== "A") throw new Error(`Incorrect grade: expected A, got ${prop.grade}`);

  console.log("\n✅ E2E Integration Test passed successfully!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
