/**
 * Docs corpus schema — EVERY field carries a source URL (R1). Fields that could
 * not be sourced this research pass are OMITTED; the loader then leaves the
 * dimension partial/unknown and the rubric flags it. No memory-derived numbers.
 */
import { z } from "zod";

const sourced = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value,
    /** URL of the document this value was read from. */
    source: z.string().url(),
    /** Caveats: secondary source, proxy reasoning, etc. Surface in narrative. */
    note: z.string().optional(),
  });

export const AssetDocSchema = z.object({
  assetId: z.string(),
  symbol: z.string(),
  /** Mantle mainnet address — must match the getCode+symbol() verified list in CLAUDE.md. */
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  chainId: z.literal(5000),
  researchedAt: z.string(), // ISO date of the research pass (for attestation-age proxies)
  collateral: z
    .object({
      backingType: sourced(z.enum(["tbills", "eth_lst", "synthetic_delta_neutral", "btc_custodial"])),
      attestationAgeDays: sourced(z.number().min(0)),
      collateralRatio: sourced(z.number().positive()),
    })
    .partial()
    .optional(),
  redemption: z
    .object({
      onchainRedemption: sourced(z.boolean()),
      noticeDays: sourced(z.number().min(0)),
      redemptionVolume90dPctSupply: sourced(z.number().min(0)),
    })
    .partial()
    .optional(),
  concentration: z
    .object({
      singlePointsOfFailure: sourced(z.number().int().min(0)),
      bridgeDependency: sourced(z.boolean()),
      // top10HolderPct comes from on-chain probes (P2), never from docs.
    })
    .partial()
    .optional(),
  transparency: z
    .object({
      attestationCadenceDays: sourced(z.number().min(0).nullable()),
      docsCompleteness: sourced(z.number().min(0).max(1)),
      // contractsVerified comes from the explorer probe (P2), never from docs.
    })
    .partial()
    .optional(),
});

export type AssetDoc = z.infer<typeof AssetDocSchema>;
