import { describe, expect, it } from "vitest";
import { ASSET_IDS, loadAssetDoc, toRubricInputs } from "../src/corpus/load.js";
import { buildDossier } from "../src/rubric/score.js";

const VERIFIED_ADDRESSES: Record<string, string> = {
  usdy: "0x5bE26527e817998A7206475496fDE1E68957c5A6",
  meth: "0xcDA86A272531e8640cD7F1a92c01839911B90bb0",
  usde: "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34",
  fbtc: "0xC96dE26018A54D51c097160568752c4E3BD6C364",
};

describe("docs corpus", () => {
  it("all four asset docs validate against the zod schema", () => {
    for (const id of ASSET_IDS) expect(() => loadAssetDoc(id)).not.toThrow();
  });
  it("addresses match the live-verified list (R1 lockstep with CLAUDE.md)", () => {
    for (const id of ASSET_IDS) expect(loadAssetDoc(id).address).toBe(VERIFIED_ADDRESSES[id]);
  });
  it("every present field carries an https source URL", () => {
    for (const id of ASSET_IDS) {
      const doc = loadAssetDoc(id) as unknown as Record<string, unknown>;
      for (const dim of ["collateral", "redemption", "concentration", "transparency"]) {
        const d = doc[dim] as Record<string, { source?: string }> | undefined;
        if (!d) continue;
        for (const [field, v] of Object.entries(d)) {
          expect(v.source, `${id}.${dim}.${field}`).toMatch(/^https:\/\//);
        }
      }
    }
  });
  it("loader includes only complete dimensions; FBTC redemption stays unknown (noticeDays unsourced)", () => {
    const fbtc = toRubricInputs(loadAssetDoc("fbtc"));
    expect(fbtc.inputs.redemption).toBeUndefined();
    const usdy = toRubricInputs(loadAssetDoc("usdy"));
    expect(usdy.inputs.redemption).toBeDefined();
  });
  it("corpus-only dossiers build with unknown flags for probe-dependent dims", () => {
    for (const id of ASSET_IDS) {
      const { inputs } = toRubricInputs(loadAssetDoc(id));
      const d = buildDossier(inputs);
      expect(d.flags.some((f) => f.includes("liquidity"))).toBe(true); // probes not run yet
      expect(d.composite).toBeGreaterThan(0);
    }
  });
  it("caveat notes propagate for the narrative layer", () => {
    const { notes } = toRubricInputs(loadAssetDoc("usde"));
    expect(Object.keys(notes).length).toBeGreaterThan(2);
    expect(JSON.stringify(notes)).toMatch(/whitelist/i);
  });
});
