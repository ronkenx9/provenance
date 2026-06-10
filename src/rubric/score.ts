/**
 * PROVENANCE rubric engine — pure functions only.
 * No I/O, no Date.now(), no randomness, no LLM (R3: the model never produces a number).
 * Same inputs => byte-identical Dossier. Every adjustment is logged into `factors`
 * so a judge (or an agent) can audit exactly why a score is what it is.
 */
import weightsJson from "./weights.json" with { type: "json" };
import type {
  CollateralInputs, ConcentrationInputs, DimensionName, DimensionScore,
  Dossier, LiquidityInputs, RedemptionInputs, RubricInputs, TransparencyInputs,
} from "./types.js";

export const RUBRIC_VERSION: string = weightsJson.version;
export const WEIGHTS: Record<DimensionName, number> = weightsJson.dimensions as Record<DimensionName, number>;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));

export function scoreCollateral(i: CollateralInputs): { score: number; factors: string[] } {
  const factors: string[] = [];
  // Base by backing type: hardest claims first.
  const base = { tbills: 90, eth_lst: 78, btc_custodial: 72, synthetic_delta_neutral: 60 }[i.backingType];
  factors.push(`base ${base} for backing type ${i.backingType}`);
  let s = base;
  // Attestation freshness: 0 penalty <=35d, then -0.5/day, capped -25.
  const stale = Math.max(0, i.attestationAgeDays - 35);
  const stalePen = Math.min(25, stale * 0.5);
  if (stalePen > 0) { s -= stalePen; factors.push(`-${stalePen} attestation ${i.attestationAgeDays}d old (>35d)`); }
  else factors.push(`attestation fresh (${i.attestationAgeDays}d)`);
  // Collateralization: >=102% +5; 100–102% 0; each 1% under 100% costs 10.
  if (i.collateralRatio >= 1.02) { s += 5; factors.push(`+5 over-collateralized (${(i.collateralRatio * 100).toFixed(1)}%)`); }
  else if (i.collateralRatio < 1.0) {
    const pen = Math.min(40, (1.0 - i.collateralRatio) * 1000);
    s -= pen; factors.push(`-${pen.toFixed(1)} under-collateralized (${(i.collateralRatio * 100).toFixed(1)}%)`);
  } else factors.push(`fully collateralized (${(i.collateralRatio * 100).toFixed(1)}%)`);
  return { score: clamp(s), factors };
}

export function scoreRedemption(i: RedemptionInputs): { score: number; factors: string[] } {
  const factors: string[] = [];
  let s = i.onchainRedemption ? 75 : 45;
  factors.push(i.onchainRedemption ? "base 75: on-chain redemption path exists" : "base 45: no on-chain redemption (market-exit only)");
  // Notice period: same-day +10; each day costs 2, capped -20.
  if (i.noticeDays <= 0) { s += 10; factors.push("+10 same-day settlement"); }
  else { const pen = Math.min(20, i.noticeDays * 2); s -= pen; factors.push(`-${pen} notice period ${i.noticeDays}d`); }
  // Proven usage: >=2% of supply redeemed in 90d +15; >=0.5% +8; else 0 ("untested path").
  if (i.redemptionVolume90dPctSupply === undefined) factors.push("redemption volume unsourced — no usage bonus (R4: logged, not defaulted)");
  else if (i.redemptionVolume90dPctSupply >= 2) { s += 15; factors.push(`+15 redemption path well-used (${i.redemptionVolume90dPctSupply}% of supply / 90d)`); }
  else if (i.redemptionVolume90dPctSupply >= 0.5) { s += 8; factors.push(`+8 redemption path used (${i.redemptionVolume90dPctSupply}%)`); }
  else factors.push(`redemption path untested at scale (${i.redemptionVolume90dPctSupply}% / 90d)`);
  return { score: clamp(s), factors };
}

export function scoreLiquidity(i: LiquidityInputs): { score: number; factors: string[] } {
  const factors: string[] = [];
  // TVL depth relative to market cap.
  const tvlPct = i.marketCapUsd > 0 ? (i.dexTvlUsd / i.marketCapUsd) * 100 : 0;
  let s = tvlPct >= 5 ? 80 : tvlPct >= 1 ? 65 : tvlPct >= 0.2 ? 45 : 25;
  factors.push(`base ${s}: DEX TVL ${tvlPct.toFixed(2)}% of market cap ($${Math.round(i.dexTvlUsd).toLocaleString("en-US")})`);
  // Exit cost for $100k: <=10bps +15; <=50bps +5; >100bps -15.
  if (i.depthToExit100kBps <= 10) { s += 15; factors.push(`+15 exit $100k at ${i.depthToExit100kBps}bps`); }
  else if (i.depthToExit100kBps <= 50) { s += 5; factors.push(`+5 exit $100k at ${i.depthToExit100kBps}bps`); }
  else if (i.depthToExit100kBps > 100) { s -= 15; factors.push(`-15 exit $100k costs ${i.depthToExit100kBps}bps`); }
  else factors.push(`exit $100k at ${i.depthToExit100kBps}bps (neutral)`);
  // Volume: 7d volume >= 10% of TVL +5 (alive), < 1% -10 (stagnant).
  if (i.vol7dUsd === undefined) factors.push("volume data unavailable from source — no volume adjustment (R4: logged, not defaulted)");
  else {
    const volPct = i.dexTvlUsd > 0 ? (i.vol7dUsd / i.dexTvlUsd) * 100 : 0;
    if (volPct >= 10) { s += 5; factors.push(`+5 active volume (7d = ${volPct.toFixed(0)}% of TVL)`); }
    else if (volPct < 1) { s -= 10; factors.push(`-10 stagnant volume (7d = ${volPct.toFixed(1)}% of TVL)`); }
    else factors.push(`volume neutral (7d = ${volPct.toFixed(0)}% of TVL)`);
  }
  return { score: clamp(s), factors };
}

export function scoreConcentration(i: ConcentrationInputs): { score: number; factors: string[] } {
  const factors: string[] = [];
  // Holder concentration: <=20% top-10 → 85 base; each pt above 20 costs 1, floor 20.
  let s = i.top10HolderPct <= 20 ? 85 : Math.max(20, 85 - (i.top10HolderPct - 20));
  factors.push(`base ${s}: top-10 holders ${i.top10HolderPct}% of supply`);
  // Single points of failure: each costs 6, capped -24.
  const spofPen = Math.min(24, i.singlePointsOfFailure * 6);
  if (spofPen > 0) { s -= spofPen; factors.push(`-${spofPen} ${i.singlePointsOfFailure} single point(s) of failure`); }
  else factors.push("no identified single points of failure");
  if (i.bridgeDependency) { s -= 10; factors.push("-10 canonical supply depends on a bridge"); }
  else factors.push("no bridge dependency");
  return { score: clamp(s), factors };
}

export function scoreTransparency(i: TransparencyInputs): { score: number; factors: string[] } {
  const factors: string[] = [];
  let s: number;
  if (i.attestationCadenceDays === null) { s = 30; factors.push("base 30: no public attestations"); }
  else if (i.attestationCadenceDays <= 1) { s = 90; factors.push("base 90: daily attestations"); }
  else if (i.attestationCadenceDays <= 31) { s = 75; factors.push(`base 75: attestations every ${i.attestationCadenceDays}d`); }
  else { s = 55; factors.push(`base 55: attestations every ${i.attestationCadenceDays}d (sparse)`); }
  if (i.contractsVerified) { s += 5; factors.push("+5 contracts verified"); }
  else { s -= 15; factors.push("-15 contracts unverified"); }
  const docs = Math.round((i.docsCompleteness - 0.5) * 20);
  s += docs; factors.push(`${docs >= 0 ? "+" : ""}${docs} docs completeness ${(i.docsCompleteness * 100).toFixed(0)}%`);
  return { score: clamp(s), factors };
}

export function buildDossier(inputs: RubricInputs): Dossier {
  const scorers: Record<DimensionName, ((i: never) => { score: number; factors: string[] })> = {
    collateral: scoreCollateral as never,
    redemption: scoreRedemption as never,
    liquidity: scoreLiquidity as never,
    concentration: scoreConcentration as never,
    transparency: scoreTransparency as never,
  };
  const order: DimensionName[] = ["collateral", "redemption", "liquidity", "concentration", "transparency"];
  const flags: string[] = [];

  const raw = order.map((dim) => {
    const input = inputs[dim];
    if (input === undefined) {
      flags.push(`dimension '${dim}' UNKNOWN — no sourced inputs; weight redistributed`);
      return { dimension: dim, score: null as number | null, factors: ["no sourced inputs — dimension flagged unknown"], unknown: true };
    }
    const { score, factors } = scorers[dim](input as never);
    return { dimension: dim, score: score as number | null, factors, unknown: false };
  });

  // Redistribute weights of unknown dimensions proportionally across known ones (R4).
  const knownWeight = raw.reduce((acc, d) => acc + (d.unknown ? 0 : WEIGHTS[d.dimension]), 0);
  if (knownWeight === 0) throw new Error("All dimensions unknown — refusing to produce a score from nothing.");

  const dimensions: DimensionScore[] = raw.map((d) => ({
    ...d,
    effectiveWeight: d.unknown ? 0 : Math.round((WEIGHTS[d.dimension] / knownWeight) * 1000) / 10,
  }));

  const composite = Math.round(
    dimensions.reduce((acc, d) => acc + (d.score ?? 0) * (d.effectiveWeight / 100), 0) * 10,
  ) / 10;

  const grade = (weightsJson.gradeBands as { grade: Dossier["grade"]; min: number }[])
    .find((b) => composite >= b.min)!.grade;

  return { rubricVersion: RUBRIC_VERSION, composite, grade, dimensions, flags };
}
