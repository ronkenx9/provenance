/**
 * Asset probe — gathers the probe-side rubric inputs for one asset:
 *   - totalSupply/decimals (Mantle RPC)
 *   - price (DeFiLlama coins) -> marketCap = price * supply (chain-local, documented)
 *   - DEX TVL on Mantle (DeFiLlama yields pools, DEX projects only)
 *   - depth proxy: constant-product price-impact estimate from largest pool (LABELED PROXY)
 *   - contractsVerified (Sourcify, chain 5000)
 *   - top-10 holder share (Blockscout v2; gracefully null when explorer is down — R4)
 * Every external miss is recorded as null + a note, never defaulted.
 */
import { createPublicClient, formatUnits, http } from "viem";
import { mantle } from "../chains.js";
import type { ProbeData } from "../corpus/load.js";

const ERC20_ABI = [
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;


export interface ProbeResult {
  assetId: string;
  address: string;
  fetchedAt: string;
  totalSupply: number | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  dexTvlUsd: number | null;
  dexPoolCount: number;
  largestPoolTvlUsd: number | null;
  depthToExit100kBps: number | null;
  contractsVerifiedSourcify: boolean | null;
  top10HolderPct: number | null;
  notes: string[];
}

async function jget(url: string, timeoutMs = 20000): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export async function probeAsset(assetId: string, address: `0x${string}`, symbol: string): Promise<ProbeResult> {
  const notes: string[] = [];
  const out: ProbeResult = {
    assetId, address, fetchedAt: new Date().toISOString(),
    totalSupply: null, priceUsd: null, marketCapUsd: null,
    dexTvlUsd: null, dexPoolCount: 0, largestPoolTvlUsd: null, depthToExit100kBps: null,
    contractsVerifiedSourcify: null, top10HolderPct: null, notes,
  };

  // --- on-chain supply ---
  try {
    const client = createPublicClient({ chain: mantle, transport: http() });
    const [supply, decimals] = await Promise.all([
      client.readContract({ address, abi: ERC20_ABI, functionName: "totalSupply" }),
      client.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }),
    ]);
    out.totalSupply = Number(formatUnits(supply, decimals));
  } catch (e) { notes.push(`totalSupply probe failed: ${(e as Error).message}`); }

  // --- price ---
  try {
    const d = (await jget(`https://coins.llama.fi/prices/current/mantle:${address}`)) as
      { coins: Record<string, { price: number; confidence: number }> };
    const c = d.coins[`mantle:${address}`];
    if (c && c.confidence >= 0.8) out.priceUsd = c.price;
    else notes.push(`price missing or low-confidence (${c?.confidence ?? "absent"})`);
  } catch (e) { notes.push(`price probe failed: ${(e as Error).message}`); }

  if (out.totalSupply !== null && out.priceUsd !== null) {
    out.marketCapUsd = out.totalSupply * out.priceUsd;
    notes.push("marketCap = Mantle-chain supply x price (chain-local cap, not global)");
  }

  // --- DEX TVL on Mantle (GeckoTerminal: real pool reserves) ---
  try {
    const d = (await jget(`https://api.geckoterminal.com/api/v2/networks/mantle/tokens/${address}/pools?page=1`)) as
      { data: { attributes: { reserve_in_usd: string; volume_usd?: { h24?: string } } }[] };
    const pools = d.data ?? [];
    out.dexPoolCount = pools.length;
    const reserves = pools.map((p) => Number(p.attributes.reserve_in_usd) || 0);
    out.dexTvlUsd = reserves.reduce((a, b) => a + b, 0);
    out.largestPoolTvlUsd = reserves.length ? Math.max(...reserves) : null;
    const vol24 = pools.reduce((a, p) => a + (Number(p.attributes.volume_usd?.h24) || 0), 0);
    notes.push(`dex pools via GeckoTerminal (top 20): aggregate 24h volume $${Math.round(vol24).toLocaleString("en-US")} (7d volume not provided -> vol adjustment skipped)`);
    if (!pools.length) notes.push("no DEX pools found for token on Mantle (GeckoTerminal)");
  } catch (e) { notes.push(`dex tvl probe failed: ${(e as Error).message}`); }

  // --- depth proxy (LABELED): constant-product impact of a $100k exit vs largest pool ---
  if (out.largestPoolTvlUsd && out.largestPoolTvlUsd > 0) {
    const reserveSide = out.largestPoolTvlUsd / 2;
    out.depthToExit100kBps = Math.round((100_000 / reserveSide) * 10_000);
    notes.push("depthToExit100kBps is a PROXY: constant-product impact estimate against the largest pool's TVL/2, not a routed quote");
  }

  // --- verification (Sourcify) ---
  try {
    const d = (await jget(`https://sourcify.dev/server/v2/contract/5000/${address}`)) as { match: string | null };
    out.contractsVerifiedSourcify = d.match === "exact_match" || d.match === "match" ? true : null;
    if (out.contractsVerifiedSourcify !== true) notes.push("not verified on Sourcify; may be verified on MantleScan (requires API key) — recorded as null, NOT false");
  } catch {
    out.contractsVerifiedSourcify = null;
    notes.push("Sourcify has no entry for this address (404) — verification status unknown, NOT false");
  }

  // --- top holders (Blockscout v2; flaky) ---
  try {
    const d = (await jget(`https://explorer.mantle.xyz/api/v2/tokens/${address}/holders`, 12000)) as
      { items: { value: string }[] };
    if (out.totalSupply && d.items?.length) {
      // values are raw; recompute share against raw supply via first item heuristic is unsafe — use ratios of raw values
      const raw = d.items.slice(0, 10).map((i) => BigInt(i.value));
      const top10 = raw.reduce((a, b) => a + b, 0n);
      // fetch raw supply once more for exact ratio
      const client = createPublicClient({ chain: mantle, transport: http() });
      const supplyRaw = await client.readContract({ address, abi: ERC20_ABI, functionName: "totalSupply" });
      out.top10HolderPct = Math.round(Number((top10 * 10000n) / supplyRaw) / 100);
    }
  } catch (e) { notes.push(`holders probe failed (explorer outage tolerated): ${(e as Error).message}`); }

  return out;
}

/** Map a ProbeResult to the loader's ProbeData (only fields that are real). */
export function toProbeData(r: ProbeResult): ProbeData {
  const probe: ProbeData = {};
  if (r.dexTvlUsd !== null && r.marketCapUsd !== null && r.depthToExit100kBps !== null) {
    probe.liquidity = { dexTvlUsd: r.dexTvlUsd, marketCapUsd: r.marketCapUsd, depthToExit100kBps: r.depthToExit100kBps };
  } else if (r.dexTvlUsd === 0 && r.marketCapUsd !== null) {
    // zero DEX pools is a REAL finding (no exit liquidity), not missing data
    probe.liquidity = { dexTvlUsd: 0, marketCapUsd: r.marketCapUsd, depthToExit100kBps: 10_000 };
  }
  if (r.top10HolderPct !== null) probe.top10HolderPct = r.top10HolderPct;
  // Sourcify "verified" is trustworthy true; null/false stays undefined (verification may exist elsewhere)
  if (r.contractsVerifiedSourcify === true) probe.contractsVerified = true;
  return probe;
}
