import { describe, expect, it } from "vitest";
import weights from "../src/rubric/weights.json" with { type: "json" };
import { buildDossier, WEIGHTS } from "../src/rubric/score.js";
import type { RubricInputs } from "../src/rubric/types.js";

const fullInputs: RubricInputs = {
  collateral: { backingType: "tbills", attestationAgeDays: 10, collateralRatio: 1.02 },
  redemption: { onchainRedemption: true, noticeDays: 1, redemptionVolume90dPctSupply: 3 },
  liquidity: { dexTvlUsd: 5_000_000, marketCapUsd: 80_000_000, vol7dUsd: 900_000, depthToExit100kBps: 12 },
  concentration: { top10HolderPct: 35, singlePointsOfFailure: 2, bridgeDependency: true },
  transparency: { attestationCadenceDays: 1, contractsVerified: true, docsCompleteness: 0.9 },
};

describe("weights.json", () => {
  it("dimension weights sum to exactly 100", () => {
    expect(Object.values(weights.dimensions).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("grade bands cover 0 and are descending", () => {
    const mins = weights.gradeBands.map((b) => b.min);
    expect(mins.at(-1)).toBe(0);
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);
  });
});

describe("determinism (the anti-hallucination defense)", () => {
  it("same inputs produce byte-identical dossiers", () => {
    const a = JSON.stringify(buildDossier(fullInputs));
    const b = JSON.stringify(buildDossier(structuredClone(fullInputs)));
    expect(a).toBe(b);
  });
  it("every factor adjustment is logged (auditable receipt)", () => {
    const d = buildDossier(fullInputs);
    for (const dim of d.dimensions) expect(dim.factors.length).toBeGreaterThan(0);
  });
});

describe("unknown handling (R4: unknown != default)", () => {
  it("missing dimension is flagged, scored null, weight redistributed", () => {
    const { liquidity: _omit, ...rest } = fullInputs;
    const d = buildDossier(rest);
    const liq = d.dimensions.find((x) => x.dimension === "liquidity")!;
    expect(liq.unknown).toBe(true);
    expect(liq.score).toBeNull();
    expect(liq.effectiveWeight).toBe(0);
    expect(d.flags.some((f) => f.includes("liquidity") && f.includes("UNKNOWN"))).toBe(true);
    // remaining effective weights re-normalize to ~100
    const total = d.dimensions.reduce((a, x) => a + x.effectiveWeight, 0);
    expect(Math.abs(total - 100)).toBeLessThan(0.5);
  });
  it("refuses to score when everything is unknown", () => {
    expect(() => buildDossier({})).toThrow(/refusing/i);
  });
});

describe("rubric discrimination", () => {
  it("tbills-backed transparent asset outscores a synthetic with stale attestations", () => {
    const strong = buildDossier(fullInputs);
    const weak = buildDossier({
      ...fullInputs,
      collateral: { backingType: "synthetic_delta_neutral", attestationAgeDays: 80, collateralRatio: 1.0 },
      transparency: { attestationCadenceDays: 60, contractsVerified: true, docsCompleteness: 0.6 },
    });
    expect(strong.composite).toBeGreaterThan(weak.composite + 5);
  });
  it("grade bands map correctly", () => {
    const d = buildDossier(fullInputs);
    expect(["AA", "A", "B", "C", "D"]).toContain(d.grade);
    if (d.composite >= 85) expect(d.grade).toBe("AA");
    else if (d.composite >= 70) expect(d.grade).toBe("A");
  });
  it("weights table matches export", () => {
    expect(WEIGHTS.collateral + WEIGHTS.redemption + WEIGHTS.liquidity + WEIGHTS.concentration + WEIGHTS.transparency).toBe(100);
  });
});
