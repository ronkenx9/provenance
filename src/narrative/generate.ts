/**
 * Narrative generation: calls Claude API with validation loop, or loads
 * pre-generated narratives from data/narratives/.
 *
 * When ANTHROPIC_API_KEY is set → live generation with up to 3 validation attempts.
 * Otherwise → reads from data/narratives/<assetId>.txt (pre-generated + human-reviewed).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildNarrativePrompt, validateNarrative, type NarrativeContext } from "./prompt.js";
import type { Dossier } from "../rubric/types.js";

const NARRATIVE_DIR = join(process.cwd(), "data", "narratives");
const MAX_ATTEMPTS = 3;

function narrativePath(assetId: string) { return join(NARRATIVE_DIR, `${assetId}.txt`); }

export function loadPregenerated(assetId: string): string | null {
  const p = narrativePath(assetId);
  return existsSync(p) ? readFileSync(p, "utf8").trim() : null;
}

async function callClaude(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content.find((c) => c.type === "text")?.text ?? "";
}

export async function generateNarrative(ctx: NarrativeContext): Promise<{ narrative: string; source: "api" | "pregenerated"; attempts: number }> {
  // Try pre-generated first if no API key
  if (!process.env.ANTHROPIC_API_KEY) {
    const pre = loadPregenerated(ctx.assetId);
    if (pre) {
      const check = validateNarrative(pre, ctx.dossier);
      if (check.valid) return { narrative: pre, source: "pregenerated", attempts: 0 };
      console.warn(`pre-generated narrative for ${ctx.symbol} has validation issues: ${check.mismatches.join(", ")} — using anyway (no API key)`);
      return { narrative: pre, source: "pregenerated", attempts: 0 };
    }
    throw new Error(`No ANTHROPIC_API_KEY and no pre-generated narrative at ${narrativePath(ctx.assetId)}`);
  }

  // Live generation with validation loop
  const prompt = buildNarrativePrompt(ctx);
  let lastNarrative = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const fullPrompt = attempt === 1 ? prompt : `${prompt}\n\nPREVIOUS ATTEMPT REJECTED — these numbers appeared in your text but don't match any computed value: ${validateNarrative(lastNarrative, ctx.dossier).mismatches.join(", ")}. Fix them.`;
    lastNarrative = await callClaude(fullPrompt);
    const check = validateNarrative(lastNarrative, ctx.dossier);
    if (check.valid) {
      // Save for future offline use
      mkdirSync(NARRATIVE_DIR, { recursive: true });
      writeFileSync(narrativePath(ctx.assetId), lastNarrative);
      return { narrative: lastNarrative, source: "api", attempts: attempt };
    }
    console.warn(`attempt ${attempt}: mismatches [${check.mismatches.join(",")}] banned [${check.bannedHits.join(",")}]`);
  }

  throw new Error(`Narrative validation failed after ${MAX_ATTEMPTS} attempts for ${ctx.symbol}. Last mismatches: ${validateNarrative(lastNarrative, ctx.dossier).mismatches.join(", ")}`);
}
