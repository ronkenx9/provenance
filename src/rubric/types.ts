/**
 * Rubric input types — every field is QUANTIFIABLE. If a field can't be sourced,
 * the caller omits the whole dimension input and the engine flags it `unknown`
 * (R4: unknown ≠ default; weight is redistributed, flag surfaces in output).
 */

export type BackingType =
  | "tbills"                 // short-duration treasuries (USDY)
  | "eth_lst"                // staked ETH (mETH)
  | "synthetic_delta_neutral" // perp-hedged synthetic dollar (USDe)
  | "btc_custodial";         // custodied BTC (FBTC)

export interface CollateralInputs {
  backingType: BackingType;
  /** Days since the most recent public attestation/PoR report. */
  attestationAgeDays: number;
  /** Collateral value / liabilities, e.g. 1.02 = 102% backed. */
  collateralRatio: number;
}

export interface RedemptionInputs {
  /** A redemption path callable on-chain by holders (not just market sell). */
  onchainRedemption: boolean;
  /** Notice/settlement period in days for primary redemption. */
  noticeDays: number;
  /** 90-day primary redemption volume as % of supply (proves the path is real). OPTIONAL: when unsourced, scorer logs it and grants no usage bonus. */
  redemptionVolume90dPctSupply?: number;
}

export interface LiquidityInputs {
  dexTvlUsd: number;
  marketCapUsd: number;
  vol7dUsd: number;
  /** Slippage in bps to exit a $100k position via best on-chain route. */
  depthToExit100kBps: number;
}

export interface ConcentrationInputs {
  top10HolderPct: number;
  /** Count of single points of failure (custodians, issuers, oracles). */
  singlePointsOfFailure: number;
  /** Asset depends on a bridge for canonical supply on this chain. */
  bridgeDependency: boolean;
}

export interface TransparencyInputs {
  /** Publication cadence of attestations in days; null = no public attestations. */
  attestationCadenceDays: number | null;
  contractsVerified: boolean;
  /** Docs completeness checklist score 0..1 (issuer docs, terms, risk disclosures, audits). */
  docsCompleteness: number;
}

export interface RubricInputs {
  collateral?: CollateralInputs;
  redemption?: RedemptionInputs;
  liquidity?: LiquidityInputs;
  concentration?: ConcentrationInputs;
  transparency?: TransparencyInputs;
}

export type DimensionName = "collateral" | "redemption" | "liquidity" | "concentration" | "transparency";

export interface DimensionScore {
  dimension: DimensionName;
  /** 0–100, or null when inputs were missing (unknown). */
  score: number | null;
  /** Effective weight used after unknown-redistribution. */
  effectiveWeight: number;
  /** Human-auditable reasons for every add/subtract — the determinism receipt. */
  factors: string[];
  unknown: boolean;
}

export interface Dossier {
  rubricVersion: string;
  composite: number;
  grade: "AA" | "A" | "B" | "C" | "D";
  dimensions: DimensionScore[];
  /** Flags for every unknown dimension — must surface in narrative + UI. */
  flags: string[];
}
