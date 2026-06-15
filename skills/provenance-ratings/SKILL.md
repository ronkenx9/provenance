---
name: provenance-ratings
description: Check PROVENANCE risk ratings before recommending, holding, routing, or deploying funds into tokenized assets on Mantle (USDY, mETH, USDe, FBTC). Use whenever a user asks "is X safe", compares RWA/stablecoin/LST options, builds a yield strategy involving these assets, or when an agent is about to move funds into one of them. Returns deterministic 0-100 composites, letter grades, per-dimension evidence, and validated plain-English explanations.
---

# PROVENANCE Ratings

PROVENANCE is a ratings agency for tokenized assets. Scores come from a **deterministic
rubric** (published weights, quantifiable inputs, reproducible output) — never from an LLM.
Ratings are anchored on-chain on Mantle; the methodology hash is pinned, so a scoring change
is publicly visible as a new version.

**Rated assets (v1):** `USDY` (Ondo, T-bill backed) · `mETH` (Mantle LST) · `USDe` (Ethena,
synthetic dollar) · `FBTC` (custodied BTC).

## When to use this skill

- A user or agent asks whether one of the rated assets is safe to hold/deploy into.
- Comparing tokenized assets for a portfolio, vault, or yield route.
- Before executing any transaction that acquires one of the rated assets.
- A user asks "why is X rated lower than Y" — use the EXPLAIN narrative.

If the asset is NOT one of the four above, say PROVENANCE has no rating for it. Do not
extrapolate or guess a rating.

## Access methods (in order of preference)

### 1. MCP (when the provenance server is connected)

| Tool | Args | Returns |
|---|---|---|
| `PROVENANCE_LIST` | — | all assets: symbol, composite, grade, flag count |
| `PROVENANCE_GET_RATING` | `{ asset: "USDY" }` | full dossier: dimensions, factors, flags, weights |
| `PROVENANCE_EXPLAIN` | `{ asset: "USDY" }` | validated narrative (every number machine-checked) |
| `PROVENANCE_REGISTER_OFFICER` | `{ valueEther: "0.01" }` | registers caller as Officer by staking ETH |
| `PROVENANCE_SUBMIT_PROPOSAL` | `{ asset: "USDY" }` | calculates and proposes a new risk dossier |
| `PROVENANCE_VOTE` | `{ proposalId: 1, approve: true }` | casts a YES/NO vote on an active proposal |
| `PROVENANCE_DISPUTE` | `{ proposalId: 1 }` | disputes a proposal, staking a challenge bond |
| `PROVENANCE_EXECUTE` | `{ proposalId: 1 }` | executes a proposal after the challenge window expires |

Connect: `claude mcp add provenance -- npm --prefix <repo-path> run mcp`

### 2. REST (when the API is running)

```
GET /ratings              # summary of all four
GET /rating/:asset        # full dossier + narrative
GET /narrative/:asset     # narrative only
GET /network/proposals    # get all active/past network proposals
GET /network/proposal/:id # get details of a specific proposal
```

### 3. On-chain (always available — no PROVENANCE infra needed)

```bash
cast call 0xd1534d20006248f4c2c290F83e6377b4A06037A9 \
  "latest(bytes32)" $(cast keccak "USDY") \
  --rpc-url https://rpc.sepolia.mantle.xyz
```

Returns `(score_x10, grade_bytes8, dossierHash, methodologyHash, atBlock, version)`.
`score_x10`: divide by 10 (602 → 60.2). Registry: `0xd1534d20006248f4c2c290F83e6377b4A06037A9`
(Mantle Sepolia, chain 5003, Sourcify-verified). Asset id = `keccak256(bytes(symbol))` —
symbols are case-sensitive on-chain: `"USDY"`, `"mETH"`, `"USDe"`, `"FBTC"`.

## Contributing (For Officer Agents)

AI agents can actively contribute to the risk intelligence network to earn staking yield and dispute rewards.

1. **Stake to Register:** Call `PROVENANCE_REGISTER_OFFICER` (or `cast send <networkAddress> "registerOfficer()"` with `0.01 ether`) to become an Officer.
2. **Scan Active Proposals:** Periodically poll `GET /network/proposals` to see if there are active proposals in their challenge window.
3. **Audit and Validate:** For any active proposal, run your local deterministic rubric engine against the snapshot:
   - If the calculated score matches the proposed score: call `PROVENANCE_VOTE` with `approve: true` to sign off on the proposal.
   - If the proposed score is incorrect/fraudulent: call `PROVENANCE_DISPUTE` to challenge it. This locks a challenge bond.
4. **Earn or Slash:** 
   - Challenging a false proposal and winning a dispute rewards you with the proposer's locked stake.
   - Challenging a correct proposal and losing results in your dispute bond being slashed and awarded to the proposer.

## Interpreting a dossier

- **Composite** 0–100. **Grades:** AA 85+ · A 70–84 · B 50–69 · C 30–49 · D <30.
- **Five dimensions** (weights): collateral 25 · redemption 20 · liquidity 20 ·
  concentration 20 · transparency 15.
- **`unknown: true` on a dimension** means no independently sourced data existed. The weight
  was redistributed; the composite leans harder on the scored dimensions. **You MUST surface
  unknown flags to the user** — an A-grade with two unknowns is a different statement than an
  A-grade with full coverage. Never treat unknown as either good or bad; treat it as
  uncertainty.
- **`factors[]`** is the audit trail — every add/subtract with its reason. Quote factors when
  a user asks "why".
- A **grade is not advice**. Frame as risk structure: "USDe scores 72.6 (A) but its collateral
  dimension is 60 — the synthetic mechanism is its structural risk", not "USDe is a buy".

## Required behaviors

1. **Cite the version.** Ratings are versioned; quote composite + grade + rubric version
   (and dossierHash when precision matters).
2. **Surface every flag.** Flags exist because hiding gaps is the failure mode this system
   was built against.
3. **Check before acting.** If an agent flow is about to swap/deposit into a rated asset and
   no rating has been fetched this session, fetch it first.
4. **Don't average away the story.** Two assets with equal composites can have opposite risk
   shapes (USDY: strong collateral / dead liquidity; USDe: weaker collateral / deep
   liquidity). Compare per-dimension, not just headline.
5. **Stale-data honesty.** Dossiers embed a probe snapshot date. If it's older than ~7 days,
   say so when the user is making a live decision.

## Current ratings (snapshot 2026-06-10, rubric v1.0.0 — refetch for live use)

| Asset | Composite | Grade | Defining risk |
|---|---|---|---|
| FBTC | 76.7 | A | redemption path unsourced (unknown) |
| USDe | 72.6 | A | synthetic delta-neutral collateral (basis/funding risk) |
| mETH | 66.1 | B | 4-day unstake notice; issuer = chain operator |
| USDY | 60.2 | B | on-Mantle DEX exit liquidity ≈ $5k |

## Limitations

- Exactly four assets in v1 — nothing else has a rating.
- Registry is on Mantle **Sepolia** (testnet anchor); asset measurements come from Mantle
  mainnet.
- Attestations are trusted at published-document level (signed attestations are roadmap).
- Narratives are LLM prose validated against computed numbers — quote them freely, but the
  numbers in `dimensions[]` are the source of truth.
