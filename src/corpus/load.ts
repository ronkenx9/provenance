/**
 * Corpus loader: sourced docs corpus (+ probe data, P2) → RubricInputs.
 * A dimension is included ONLY when its required fields are present; otherwise
 * it stays absent and buildDossier flags it unknown (R4). Notes from sourced
 * fields are collected for the narrative layer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AssetDocSchema, type AssetDoc } from "./schema.js";
import type { RubricInputs } from "../rubric/types.js";

export interface ProbeData {
  // P2 fills these from on-chain / explorer / DEX sources.
  liquidity?: { dexTvlUsd: number; marketCapUsd: number; vol7dUsd?: number; depthToExit100kBps: number };
  top10HolderPct?: number;
  contractsVerified?: boolean;
}

export interface LoadedAsset {
  doc: AssetDoc;
  inputs: RubricInputs;
  /** Source notes keyed by "dimension.field" — narrative layer must surface caveats. */
  notes: Record<string, string>;
}

export function loadAssetDoc(assetId: string, dir = join(process.cwd(), "data", "assets")): AssetDoc {
  const raw = JSON.parse(readFileSync(join(dir, `${assetId}.json`), "utf8"));
  return AssetDocSchema.parse(raw);
}

export function toRubricInputs(doc: AssetDoc, probe: ProbeData = {}): LoadedAsset {
  const inputs: RubricInputs = {};
  const notes: Record<string, string> = {};
  const note = (k: string, n?: string) => { if (n) notes[k] = n; };

  const c = doc.collateral;
  if (c?.backingType && c.attestationAgeDays && c.collateralRatio) {
    inputs.collateral = {
      backingType: c.backingType.value,
      attestationAgeDays: c.attestationAgeDays.value,
      collateralRatio: c.collateralRatio.value,
    };
    note("collateral.backingType", c.backingType.note);
    note("collateral.attestationAgeDays", c.attestationAgeDays.note);
    note("collateral.collateralRatio", c.collateralRatio.note);
  }

  const r = doc.redemption;
  if (r?.onchainRedemption && r.noticeDays) {
    inputs.redemption = {
      onchainRedemption: r.onchainRedemption.value,
      noticeDays: r.noticeDays.value,
      ...(r.redemptionVolume90dPctSupply ? { redemptionVolume90dPctSupply: r.redemptionVolume90dPctSupply.value } : {}),
    };
    note("redemption.onchainRedemption", r.onchainRedemption.note);
    note("redemption.noticeDays", r.noticeDays.note);
  }

  if (probe.liquidity) inputs.liquidity = probe.liquidity;

  const k = doc.concentration;
  if (k?.singlePointsOfFailure && k.bridgeDependency && probe.top10HolderPct !== undefined) {
    inputs.concentration = {
      top10HolderPct: probe.top10HolderPct,
      singlePointsOfFailure: k.singlePointsOfFailure.value,
      bridgeDependency: k.bridgeDependency.value,
    };
    note("concentration.singlePointsOfFailure", k.singlePointsOfFailure.note);
    note("concentration.bridgeDependency", k.bridgeDependency.note);
  }

  const t = doc.transparency;
  if (t?.attestationCadenceDays && t.docsCompleteness && probe.contractsVerified !== undefined) {
    inputs.transparency = {
      attestationCadenceDays: t.attestationCadenceDays.value,
      contractsVerified: probe.contractsVerified,
      docsCompleteness: t.docsCompleteness.value,
    };
    note("transparency.attestationCadenceDays", t.attestationCadenceDays.note);
    note("transparency.docsCompleteness", t.docsCompleteness.note);
  }

  return { doc, inputs, notes };
}

export const ASSET_IDS = ["usdy", "meth", "usde", "fbtc"] as const;
