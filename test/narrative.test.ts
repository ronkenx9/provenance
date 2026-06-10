import { describe, it, expect } from "vitest";
import { validateNarrative, buildNarrativePrompt, type NarrativeContext } from "../src/narrative/prompt.js";
import { loadPregenerated } from "../src/narrative/generate.js";
import { buildDossier } from "../src/rubric/score.js";
import { ASSET_IDS, loadAssetDoc, toRubricInputs } from "../src/corpus/load.js";
import { toProbeData, type ProbeResult } from "../src/probes/asset-probe.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Dossier } from "../src/rubric/types.js";

function loadDossier(assetId: string): Dossier {
  const doc = loadAssetDoc(assetId);
  const snap: ProbeResult = JSON.parse(readFileSync(join(process.cwd(), "data", "snapshots", `${assetId}.json`), "utf8"));
  const { inputs } = toRubricInputs(doc, toProbeData(snap));
  return buildDossier(inputs);
}

describe("narrative validation", () => {
  it("catches a deliberately-corrupted narrative", () => {
    const dossier = loadDossier("usdy");
    const corrupt = `USDY scores 99.9 with a grade of AA and its collateral is rated 42 out of 100.`;
    const result = validateNarrative(corrupt, dossier);
    expect(result.valid).toBe(false);
    expect(result.mismatches.length).toBeGreaterThan(0);
    // 99.9, 42 are not in usdy's computed values
    expect(result.mismatches).toContain("99.9");
    expect(result.mismatches).toContain("42");
  });

  it("catches banned hype words", () => {
    const dossier = loadDossier("usdy");
    const hyped = `USDY is a revolutionary asset with a composite of 60.2 and grade B.`;
    const result = validateNarrative(hyped, dossier);
    expect(result.valid).toBe(false);
    expect(result.bannedHits).toContain("revolutionary");
  });

  it("builds a well-formed prompt for each asset", () => {
    for (const id of ASSET_IDS) {
      const dossier = loadDossier(id);
      const doc = loadAssetDoc(id);
      const snap: ProbeResult = JSON.parse(readFileSync(join(process.cwd(), "data", "snapshots", `${id}.json`), "utf8"));
      const { notes } = toRubricInputs(doc, toProbeData(snap));
      const ctx: NarrativeContext = { symbol: doc.symbol, assetId: id, dossier, notes };
      const prompt = buildNarrativePrompt(ctx);
      expect(prompt).toContain(doc.symbol);
      expect(prompt).toContain(String(dossier.composite));
      expect(prompt).toContain(dossier.grade);
    }
  });

  for (const id of ASSET_IDS) {
    it(`pre-generated narrative for ${id} passes validation`, () => {
      const narrative = loadPregenerated(id);
      expect(narrative).not.toBeNull();
      const dossier = loadDossier(id);
      const result = validateNarrative(narrative!, dossier);
      if (!result.valid) {
        console.error(`${id} mismatches:`, result.mismatches, `banned:`, result.bannedHits);
      }
      expect(result.valid).toBe(true);
    });
  }
});
