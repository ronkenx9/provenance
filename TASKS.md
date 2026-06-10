# PROVENANCE — Task Plan

> Rules of engagement: ~/brain/skills/hackathon-execution-framework.md
> Work top to bottom. Every task has a GATE — the task is not done until the gate command/check
> passes. Commit after every checked task: `git commit -m "P<phase>.<n>: <task>"`.

## Phase 0 — Scaffold (½ day)
- [x] Copy scaffolding from meridian: package.json deps (viem, zod, chalk, minimist, @modelcontextprotocol/sdk, vitest, tsx), tsconfig, src/chains.ts (already 5003-fixed).
      GATE: `npm run build` passes on empty src.
- [x] Port `src/signals/` from meridian → `src/probes/` (rename, strip yield-routing specifics).
      GATE: `npx tsx -e "import('./src/probes/index.js')"` no errors.
- [x] Resolve + verify all asset addresses (USDe, FBTC on Mantle mainnet from official docs).
      GATE: `eth_getCode` returns non-0x for EVERY address on chain 5000. Record results in CLAUDE.md.

## Phase 1 — Rubric engine (1 day) — THE CORE, do before anything shiny
- [x] `src/rubric/weights.json` — five dimensions per PRD §3, version field, weights sum=100.
      GATE: unit test asserts sum.
- [x] `src/rubric/score.ts` — pure functions: inputs → dimension scores → composite → grade band.
      No I/O, no Date.now(), no randomness.
      GATE: same input twice → byte-identical output (determinism test).
- [x] Edge tests: missing input → dimension flagged `unknown`, weight redistributed, flag surfaces
      in output. Never silently default.
      GATE: `npm test` green, rubric files at 100% line coverage.
- [ ] `data/assets/{usdy,meth,usde,fbtc}.json` — structured docs corpus. EVERY field carries a
      `source` URL. Fields without a source → omit (rubric flags unknown).
      GATE: zod schema validation passes; spot-check 3 sources resolve (HTTP 200).

## Phase 2 — Probes + first real scores (1 day)
- [ ] On-chain probes: totalSupply, DEX pool TVL/depth (reuse meridian moe/agni/defillama probes),
      top-holder concentration (explorer API), redemption events where applicable.
      GATE: `npm run dev -- probe USDY` prints live mainnet numbers.
- [ ] Snapshot layer: every probe result written to `data/snapshots/<asset>-<date>.json`; engine
      can run fully from snapshot (demo resilience).
      GATE: `npm run dev -- score USDY --from-snapshot` works offline (wifi off test).
- [ ] Score all four assets end-to-end.
      GATE: four composites with ≥15-point spread and different grades. If all cluster, the rubric
      isn't discriminating — fix weights, do NOT fudge inputs.

## Phase 3 — Contract (½ day)
- [ ] `contracts/DossierRegistry.sol`: `publishDossier(assetId, score, grade, dossierHash, methodologyHash)`,
      `latest(assetId)`, `history(assetId)`, event `DossierPublished`. Owner-only publish. ~80 lines.
      GATE: foundry/hardhat tests pass incl. version increments.
- [ ] Deploy to Mantle Sepolia (5003). **Verify on explorer.sepolia.mantle.xyz.**
      GATE: explorer shows VERIFIED source. Address recorded in CLAUDE.md + README + .env.example.
- [ ] `src/anchor/` publish path (adapt meridian ledger/anchor.ts).
      GATE: `npm run dev -- publish USDY --live` → real tx; `latest("USDY")` returns the score;
      explorer link works.

## Phase 4 — Narrative layer (1 day)
- [ ] `src/narrative/prompt.ts` — input: computed scores + rubric inputs + flagged unknowns.
      Style: specific, cited, sober; bans on hype words; must mention each dimension's WHY.
- [ ] Validation pass: extract every number from generated prose; each must match a computed value
      exactly or regenerate (max 3 attempts, then fail loudly).
      GATE: validation test with a deliberately-corrupted narrative catches the mismatch.
- [ ] Generate + human-review all four narratives. The USDY-vs-USDe contrast must read sharp.
      GATE: a reader can answer "why did USDe score lower?" after one read.

## Phase 5 — Consumption surfaces (1 day)
- [ ] MCP server: PROVENANCE_GET_RATING, PROVENANCE_LIST, PROVENANCE_EXPLAIN (gaslight pattern).
      GATE: tool calls work from Claude Code against the stdio server.
- [ ] REST: `GET /rating/:asset` (single file, express or node http).
      GATE: `curl localhost:3000/rating/USDY` returns the dossier JSON.
- [ ] Frontend: grade card, 5 dimension bars, narrative, "verify on-chain" link, asset switcher.
      Use ~/brain/skills/editorial-landing-page.md for taste. This is a judged surface — budget
      half the day for polish alone.
      GATE: side-by-side USDY/USDe screenshot looks submission-grade; no Vite boilerplate anywhere.
- [ ] Deploy frontend publicly (Vercel/Netlify/Tencent).
      GATE: public URL loads on a phone.

## Phase 6 — Submission hardening (½ day) — protected, never cut
- [ ] Run FULL ~/brain/skills/ship-verification.md checklist. Fix everything it catches.
- [ ] README: one-liner, architecture diagram, setup, deployed+verified addresses, methodology
      explanation (the anti-hallucination section gets its own heading), demo URL.
- [ ] .env.example complete. Fresh-clone test: clone → install → build → test → score-from-snapshot.
- [ ] Demo video ≥2min following PRD §8 script. Record the curl, the contrast, the explorer event,
      the MCP call.
- [ ] DoraHacks submission: repo + video + contract address + public URL. Tracks: AI x RWA.
      Deployment Award checklist re-verified line by line.

## Cut order under time pressure (PRD §10)
history timeline → REST API → FBTC (4th asset) → MCP EXPLAIN action.
NEVER cut: contract verification · narrative validation pass · USDY/USDe contrast · Phase 6.
