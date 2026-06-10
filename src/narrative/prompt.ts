/**
 * Narrative prompt builder + number-validation pass.
 * The LLM NEVER produces a score — it explains computed scores in plain English.
 * Every number in the generated prose must match a value from the dossier; mismatches
 * trigger regeneration (max 3 attempts, then hard fail).
 */
import type { Dossier, DimensionScore } from "../rubric/types.js";

export interface NarrativeContext {
  symbol: string;
  assetId: string;
  dossier: Dossier;
  /** Source notes from the corpus loader — keyed by "dimension.field". */
  notes: Record<string, string>;
}

const BANNED_WORDS = [
  "revolutionary", "groundbreaking", "game-changing", "cutting-edge",
  "innovative", "best-in-class", "world-class", "state-of-the-art",
  "unparalleled", "unmatched", "unprecedented", "exciting",
];

function dimBlock(d: DimensionScore): string {
  if (d.unknown) return `- ${d.dimension}: UNKNOWN (data unavailable — weight redistributed to scored dimensions)`;
  return `- ${d.dimension}: scored ${d.score}/100 (effective weight ${d.effectiveWeight}%)\n  factors: ${d.factors.join("; ")}`;
}

export function buildNarrativePrompt(ctx: NarrativeContext): string {
  const { symbol, dossier, notes } = ctx;
  const dims = dossier.dimensions.map(dimBlock).join("\n");
  const flags = dossier.flags.length ? `Flags:\n${dossier.flags.map((f) => `- ${f}`).join("\n")}` : "No flags.";
  const caveats = Object.entries(notes)
    .filter(([, n]) => /PROXY|SECONDARY|CONSERVATIVE/i.test(n))
    .map(([k, n]) => `- ${k}: ${n}`)
    .join("\n");

  return `You are writing a risk narrative for ${symbol}, a tokenized asset rated by PROVENANCE.

COMPUTED SCORES (deterministic, not yours to modify):
  Composite: ${dossier.composite} / 100
  Grade: ${dossier.grade}

DIMENSION BREAKDOWN:
${dims}

${flags}

${caveats ? `DATA CAVEATS (must surface in narrative):\n${caveats}` : ""}

RULES — non-negotiable:
1. You explain WHY each dimension scored as it did. Every dimension gets at least one sentence.
2. For UNKNOWN dimensions: state what data was missing and that the weight was redistributed.
3. Every number you write MUST match a value from the computed scores above (composite, dimension scores, weights). Do not invent or round numbers.
4. Banned words: ${BANNED_WORDS.join(", ")}. If any appear, the narrative is rejected.
5. Tone: specific, sober, analyst-grade. No hype, no marketing language. Write like a credit analyst, not a promoter.
6. Length: 150–300 words. No headers, no bullet points, no markdown. Plain prose paragraphs.
7. Surface any data caveats (PROXY, SECONDARY SOURCE, CONSERVATIVE) naturally in the text.
8. The narrative must let a reader answer: "What is this asset's biggest risk?" after one read.

Write the narrative now.`;
}

/**
 * Extract all numbers from narrative prose and verify each exists in the dossier's
 * computed values. Returns { valid, mismatches } — caller decides whether to retry.
 */
export function validateNarrative(narrative: string, dossier: Dossier): { valid: boolean; mismatches: string[]; bannedHits: string[] } {
  // Collect all valid numbers: scores, weights, AND numbers that appear in factor strings
  const validNumbers = new Set<string>();
  validNumbers.add(String(dossier.composite));
  for (const d of dossier.dimensions) {
    if (d.score !== null) {
      validNumbers.add(String(d.score));
      validNumbers.add(String(d.effectiveWeight));
    }
    // Extract every number from factor strings — these are probe-derived values
    // that the narrative is allowed to cite (TVL, bps, percentages, etc.)
    for (const f of d.factors) {
      for (const m of f.matchAll(/(\d[\d,.]*\d|\d)/g)) {
        const raw = m[1].replace(/,/g, "");
        validNumbers.add(raw);
        // Also add sub-components for comma-formatted numbers (e.g. "2,222,876" → "2222876")
        // and the percentage/decimal forms
      }
    }
  }

  // Normalize the narrative: collapse comma-formatted numbers into plain digits
  // "$28,306,411" → "$28306411" so we match as one token
  const normalized = narrative.replace(/(\d),(\d)/g, "$1$2");

  // Extract numbers from normalized prose
  const numberPattern = /\b(\d+\.?\d*)\b/g;
  const found = [...normalized.matchAll(numberPattern)].map((m) => m[1]);
  const mismatches: string[] = [];

  for (const n of found) {
    if (/^20[0-9]{2}$/.test(n)) continue; // years
    if (["0", "1", "100", "000", "100000"].includes(n)) continue; // generic / $100k position size (rubric-defined constant)
    if (Number(n) <= 4) continue; // small ordinals, counts ("two dimensions", "3 attempts")
    if (!validNumbers.has(n)) mismatches.push(n);
  }

  const bannedHits = BANNED_WORDS.filter((w) => narrative.toLowerCase().includes(w));

  return { valid: mismatches.length === 0 && bannedHits.length === 0, mismatches, bannedHits };
}
