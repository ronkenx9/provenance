# PROVENANCE — Submission Package

> Owner actions: record video → upload → post X thread → done.
> Everything else here is prepared. Deadline: **2026-06-15 15:59** (DoraHacks lists 15:59, not 16:59 — treat the earlier time as binding).

## Submission format (verified 2026-06-11)

Phase II submits via **X post** containing: pitch, demo video, GitHub link, Mantle contract
address, hashtag **#MantleAIHackathon**. Also register the BUIDL on DoraHacks:
https://dorahacks.io/hackathon/mantleturingtesthackathon2026/detail

## Asset checklist

| Asset | Status |
|---|---|
| GitHub repo | ✅ https://github.com/ronkenx9/provenance |
| Contract (Mantle Sepolia 5003) | ✅ `0xd1534d20006248f4c2c290F83e6377b4A06037A9` — Sourcify exact_match |
| Live landing | ✅ https://ronkenx9.github.io/provenance/ |
| Live viewer | ✅ https://ronkenx9.github.io/provenance/app/ |
| Live docs | ✅ https://ronkenx9.github.io/provenance/docs.html |
| Demo video | ⬜ owner records (script below) |
| X thread | ⬜ owner posts (draft below) |
| DoraHacks BUIDL | ⬜ owner registers |

---

## Demo video script (≥2min — runs ~2:40 at normal pace)

**Setup before recording:** `npm run api` running on :3000 · viewer open · explorer tab open on
the registry address · terminal ready · Claude Code with provenance MCP connected.

**[0:00–0:20] The problem.**
Show any RWA prospectus PDF.
> "Agents are starting to manage real-world-asset portfolios. This is what asset risk
> disclosure looks like today. An agent cannot read this. Every RWA project at this hackathon
> built a vault — we built the ratings agency that tells you which vaults are safe."

**[0:20–0:40] One-second rating.**
Terminal: `curl localhost:3000/rating/USDY | jq '.composite, .grade, .flags'`
> "PROVENANCE. Machine-readable risk dossiers for tokenized assets, anchored on Mantle.
> USDY: 60.2, grade B — and the flags tell you why, instantly."

**[0:40–1:20] The contrast IS the demo.**
Viewer: USDY dossier → dimension bars.
> "Scores come from a deterministic rubric — published weights, pure functions. The AI never
> produces a number. USDY: strong T-bill collateral, but look — on-Mantle exit liquidity is
> about five thousand dollars. The headline grade hides that; the dimensions don't."
Switch to USDe.
> "USDe scores HIGHER — 72.6, grade A — but for opposite reasons: deep liquidity, weaker
> collateral story. Two assets, two opposite risk shapes. An average would lie to you.
> A dossier doesn't."

**[1:20–1:45] Verify on-chain.**
Explorer: DossierPublished events, then `latest(bytes32)` read.
> "Every dossier is anchored on Mantle: score, grade, dossier hash, and the methodology hash —
> change the rubric and it's publicly visible as a new version. No silent re-ratings.
> Sourcify-verified, readable by any contract or agent with zero PROVENANCE infrastructure."

**[1:45–2:20] Agents consume it.**
Claude Code: "Should I deploy idle USDC into USDe on Mantle?"
→ MCP tool call PROVENANCE_GET_RATING fires on screen.
> "This is the point. The MCP server plus an agent skill make any agent risk-aware. It cites
> the on-chain rating, surfaces the unknown flags, and refuses to extrapolate for assets we
> haven't rated. The narrative layer is LLM-written but machine-validated — every number in
> the prose is checked against the computed record, or it's rejected."

**[2:20–2:40] Close.**
Landing page hero.
> "Four assets rated in v1, 16.5 points of spread, every claim sourced or flagged unknown.
> Ratings infrastructure for the agentic economy — on Mantle. PROVENANCE."

---

## X thread draft

**Tweet 1 (the pitch + required fields):**
> Every RWA project built a vault. We built the ratings agency that tells you which vaults
> are safe.
>
> PROVENANCE — deterministic risk ratings for tokenized assets, anchored on @0xMantle.
> The AI never produces a number.
>
> 🎥 [video]
> ⚙️ https://github.com/ronkenx9/provenance
> 📜 0xd1534d20006248f4c2c290F83e6377b4A06037A9 (Mantle Sepolia)
> #MantleAIHackathon

**Tweet 2 (the anti-hallucination hook):**
> "Isn't the AI hallucinating ratings?"
>
> No — architecturally impossible. Scores come from a published deterministic rubric. The LLM
> writes prose ABOUT computed values, and a validator rejects any narrative whose numbers
> don't match the record. We test this by planting corrupted numbers — they get caught.

**Tweet 3 (the contrast):**
> USDY scores 60.2 (B): bulletproof T-bill collateral, ~$5k of exit liquidity on Mantle.
> USDe scores 72.6 (A): deep liquidity, synthetic-dollar collateral risk.
>
> Same composite range, opposite risk shapes. Averages lie. Dossiers don't.

**Tweet 4 (for agents):**
> Built for the agentic economy:
> · MCP server — 3 tools, any Claude agent becomes risk-aware
> · REST API
> · or read the registry directly: latest(bytes32) → score, grade, dossierHash, methodologyHash
>
> Live: https://ronkenx9.github.io/provenance/

## DoraHacks BUIDL fields

- **Name:** PROVENANCE
- **Tagline:** The AI ratings agency for tokenized assets — deterministic, on-chain-anchored risk dossiers agents can act on.
- **Track:** AI x RWA
- **GitHub:** https://github.com/ronkenx9/provenance
- **Demo:** https://ronkenx9.github.io/provenance/
- **Contract:** 0xd1534d20006248f4c2c290F83e6377b4A06037A9 (Mantle Sepolia 5003, Sourcify exact_match)
- **Description:** reuse README intro + Anti-Hallucination Defense section verbatim.
