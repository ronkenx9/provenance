# PROVENANCE — Product Requirements Document

> The AI ratings agency for tokenized assets. Machine-readable, on-chain-anchored risk dossiers
> that humans can read and agents can act on.

**Hackathon:** Mantle Turing Test 2026 — deadline 2026-06-15 16:59
**Track:** AI x RWA (exclusively supported by Mantle Network) → Grand Champion nomination path
**Role in portfolio:** FLAGSHIP. Also targets the 20 Project Deployment Award.

---

## 1. One-liner & thesis

Agents are about to manage RWA portfolios — and an agent cannot read a PDF prospectus.
PROVENANCE underwrites tokenized assets with a **deterministic scoring engine** and publishes
versioned risk dossiers **on-chain on Mantle**, so any human or agent can check an asset's risk
before touching it. "Moody's for the agentic economy."

**The pitch sentence for judges:** *Every RWA project at this hackathon built a vault. We built
the ratings agency that tells you which vaults are safe.*

## 2. Non-negotiable design constraint (the anti-hallucination defense)

**The LLM never produces a score. Ever.**
- Scores come from a deterministic rubric: published weights, quantifiable inputs, reproducible
  output. Same inputs → same score, verifiable by anyone.
- The LLM writes only the *narrative* layer (plain-English explanation of computed scores).
- The methodology document's hash is anchored on-chain. Changing the rubric = new version, visible.
- This is the first question a judge will ask ("isn't the AI hallucinating ratings?") and it must
  be answered in the README, the demo, and the pitch. It is our deepest moat vs. lazier entries.

## 3. Scoring rubric (v1)

Composite 0–100, five dimensions. All inputs must be computable from on-chain data or
structured public docs — if an input can't be quantified, it doesn't score (it goes in the
narrative as a flagged unknown).

| Dimension | Weight | Inputs (all quantifiable) |
|---|---|---|
| Collateral quality | 25 | Backing asset type (T-bills/ETH/synthetic), attestation freshness (days since last), over/under-collateralization ratio |
| Redemption mechanics | 20 | Redemption path exists on-chain (y/n), notice period, historical redemption volume vs. supply |
| Liquidity depth | 20 | DEX TVL across venues vs. market cap, 7d volume, depth-to-exit a $100k position under 1% slippage |
| Concentration risk | 20 | Top-10 holder share, custodian/issuer single points of failure (count), bridge dependency (y/n) |
| Transparency | 15 | Public attestations (y/n + cadence), verified contracts (y/n), docs completeness checklist score |

Grade bands: AA 85+ · A 70–84 · B 50–69 · C 30–49 · D <30.

## 4. v1 asset universe (depth over breadth — exactly four)

| Asset | Why | Data sources |
|---|---|---|
| **USDY** (Ondo) | Flagship Mantle RWA, rich public docs + attestations | Ondo docs, on-chain flows, DEX pools |
| **mETH** | Mantle's own LST — rating the sponsor's asset = ecosystem signal | mETH protocol data, on-chain |
| **USDe** (Ethena) | Synthetic dollar = genuinely different risk profile, shows rubric range | Ethena docs, funding data |
| **FBTC** | BTC RWA on Mantle, custody-heavy profile | FBTC docs, on-chain |

The demo moment: four assets, four *different* grades with visibly different reasons.
If everything scores "A", the product looks fake. USDe should score lower on collateral
quality than USDY and the narrative should say exactly why — that contrast is the demo.

## 5. Architecture

```
 INGEST                    SCORE                      PUBLISH
┌────────────────┐   ┌──────────────────┐   ┌─────────────────────────┐
│ on-chain probes│   │ rubric engine    │   │ DossierRegistry.sol     │
│ (viem: supply, │──▶│ (deterministic,  │──▶│ on Mantle Sepolia       │
│ holders, pools,│   │ pure functions,  │   │ publishDossier(asset,   │
│ TVL, redempt.) │   │ versioned weights│   │   score, grade, uriHash,│
│ docs corpus    │   │ unit-tested)     │   │   methodologyHash)      │
│ (structured    │   └────────┬─────────┘   │ event DossierPublished  │
│ JSON per asset)│            │             └─────────────────────────┘
└────────────────┘            ▼                        ▲
                     ┌──────────────────┐              │
                     │ narrative layer  │──────────────┘
                     │ (LLM writes prose│   full dossier JSON: hash
                     │ over computed    │   anchored on-chain, body
                     │ scores; never    │   served via frontend/API
                     │ alters numbers)  │
                     └──────────────────┘
 CONSUME
 ├─ Frontend: dossier viewer (the beauty surface — grade card, dimension bars, narrative)
 ├─ MCP server: PROVENANCE_GET_RATING / PROVENANCE_LIST / PROVENANCE_EXPLAIN (agents consume)
 └─ REST: GET /rating/:asset (one curl in the demo)
```

### Modules
| Module | Path | Notes |
|---|---|---|
| Probes | `src/probes/` | viem reads: totalSupply, top holders (explorer API), DEX pool TVL/depth, redemption events. **Reuse MERIDIAN `src/signals/`** (Mantle-pointed, chain-id already fixed). |
| Docs corpus | `data/assets/*.json` | Hand-structured per asset: backing type, attestation dates, custodians, redemption terms. Cited sources required per field. |
| Rubric engine | `src/rubric/` | Pure functions, zero I/O, `weights.json` versioned. 100% unit-test coverage required here. |
| Narrative | `src/narrative/` | Claude API. Prompt receives computed scores + inputs; output validated: any number in prose must match computed values (regex check) or regenerate. |
| Contract | `contracts/DossierRegistry.sol` | Minimal: publish (onlyOwner publisher), read latest + history per asset. Versioned. ~80 lines. |
| Anchor/crypto | `src/anchor/` | **Reuse MERIDIAN `src/ledger/`** (hashing/anchoring) + CORPUS ERC-8004 patterns. |
| MCP + REST | `src/mcp-server.ts`, `src/api.ts` | Same MCP stdio pattern as gaslight/meridian. |
| Frontend | `frontend/` | Vite+React. THE polish surface: grade card (shareable), 5 dimension bars, narrative, on-chain verification link, history timeline. |

## 6. Mantle parameters

- Mantle Sepolia: chain id **5003** (NOT 5001 — verified via eth_chainId 2026-06-09), RPC
  `https://rpc.sepolia.mantle.xyz`, explorer `https://explorer.sepolia.mantle.xyz`.
- Mainnet 5000 for read-probes of real assets; **publishing on Sepolia** (deployment award allows
  testnet). Stretch: publish on mainnet for Grand Champion optics.
- ERC-8004 registry already live on Sepolia at `0x8004A818BFB912233c491871b3d84c89A494BD9e`
  (verified bytecode exists; CHECK explorer-verified status before claiming).
- Asset addresses (mainnet, for probes): mETH `0xd5F7838F5C461fefF7FE49ea5ebaF7728bB0ADfa`,
  USDY `0x5bE26527e817998A7206475496fDE1E68957c5A6`, USDT `0x201EBa5d93698b3b6478951152Cc577265eEaC00`.
  USDe/FBTC: **resolve from official docs, then verify via eth_getCode before use. Never guess.**

## 7. Judging map

| Criterion | Answer |
|---|---|
| Technical Depth 30% | Probes + deterministic engine + contract + MCP + narrative validation — real architecture |
| Innovation 25% | New primitive: machine-readable on-chain ratings. Not a vault. |
| Mantle Contribution 25% | Rates Mantle's flagship assets; infra other Mantle projects can cite; on Mantle |
| Completeness 20% | 4 deep dossiers live on-chain + public frontend + MCP demo |
| Deployment award | Contract verified on explorer; `publishDossier` = AI-pipeline output written on-chain ✅ |

## 8. Demo flow (video ≥2min, script in TASKS.md phase 6)

1. Problem: agent holds $1M USDC, wants RWA yield — show a prospectus PDF. "An agent can't read this."
2. `curl /rating/USDY` → JSON: grade A, score 82, dimension breakdown. One second.
3. Frontend: USDY dossier — grade card, bars, narrative. Then USDe side-by-side: lower collateral
   grade, narrative explains the synthetic-dollar mechanism difference. **The contrast IS the demo.**
4. Click "verify": explorer shows DossierPublished event, hash matches, methodology hash anchored.
5. MCP: an agent (Claude) asks "can I deploy into USDe?" → tool call → cites the on-chain rating.
6. Close: "Every vault here needs this. Ratings infrastructure for the agentic economy, on Mantle."

## 9. Reuse map (why this is a 5-day build)

| From | What |
|---|---|
| MERIDIAN | `src/signals/` probes, `src/ledger/` hash+anchor, chains.ts (fixed), MCP/CLI scaffolding, package setup |
| CORPUS | ERC-8004 registry patterns, deployed Sepolia registry |
| ~/brain/skills/autonomous-audit-methodology.md | The underwriting mindset: recon → invariants → risk scoring → report |
| ~/brain/skills/editorial-landing-page.md | Frontend taste system |

## 10. Risks & kill-switches

| Risk | Mitigation |
|---|---|
| "AI hallucinates ratings" judge attack | Constraint §2; demo shows determinism (rerun → same score) |
| Docs data too thin for an asset | Drop to 3 assets; depth > breadth. Never pad with guessed data — cite or flag unknown |
| Probe APIs flaky in demo | All probe results cached to `data/snapshots/`; demo runs from snapshot + one live call |
| Time overrun | Cut order: history timeline → REST API → 4th asset. NEVER cut: contract verification, narrative quality, the USDY/USDe contrast |
