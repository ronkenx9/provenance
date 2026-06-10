# PROVENANCE

The AI ratings agency for tokenized assets. Deterministic, on-chain-anchored risk dossiers that humans can read and agents can act on.

**Mantle Turing Test 2026 — AI x RWA track**

> Every RWA project at this hackathon built a vault. We built the ratings agency that tells you which vaults are safe.

## What it does

PROVENANCE underwrites tokenized assets with a **deterministic scoring engine** and publishes versioned risk dossiers **on-chain on Mantle**, so any human or agent can check an asset's risk profile before touching it.

Four assets rated in v1: **USDY** (Ondo), **mETH** (Mantle LST), **USDe** (Ethena), **FBTC** — each with different risk profiles, different grades, and different reasons.

## The Anti-Hallucination Defense

**The LLM never produces a score. Ever.**

- Scores come from a deterministic rubric: published weights, quantifiable inputs, reproducible output. Same inputs → same score, verifiable by anyone.
- Five dimensions: collateral quality (25%), redemption mechanics (20%), liquidity depth (20%), concentration risk (20%), transparency (15%).
- When data is missing, the engine flags it **unknown** and redistributes weight. It never silently defaults.
- The methodology hash is anchored on-chain. A rubric change = new version, publicly visible.
- The LLM writes only the narrative layer (plain-English explanation). Every number in the prose is **validated** against computed values — mismatches trigger regeneration.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  Data Sources                     │
│  on-chain probes · DEX pools · explorer APIs      │
│  sourced docs corpus (every field has a URL)       │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│           Deterministic Rubric Engine             │
│  weights.json · score.ts · pure functions         │
│  same inputs → same output (tested)               │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│            DossierRegistry (Solidity)             │
│  publishDossier() · latest() · history()          │
│  methodology hash pins the rubric version         │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│           Consumption Surfaces                    │
│  MCP server · REST API · Frontend viewer          │
│  narratives: LLM-generated, number-validated      │
└──────────────────────────────────────────────────┘
```

## Deployed Addresses (Mantle Sepolia — chain 5003)

| Contract | Address |
|---|---|
| DossierRegistry | [`0xd1534d20006248f4c2c290F83e6377b4A06037A9`](https://explorer.sepolia.mantle.xyz/address/0xd1534d20006248f4c2c290F83e6377b4A06037A9) |
| Publisher | `0x093c1F3C6daA784376dF100e361F692DbB33acd8` |

**Verification:** Sourcify exact match.

## Rated Assets (v1)

| Asset | Composite | Grade | Key Risk |
|---|---|---|---|
| USDY | 60.2 | B | Critically thin Mantle DEX liquidity ($5k TVL) |
| mETH | 66.1 | B | 4-day unstaking + issuer-chain correlation |
| USDe | 72.6 | A | Synthetic collateral: basis/funding rate risk |
| FBTC | 76.7 | A | No sourced redemption path; custodian dependency |

Spread: 16.5 points across 2 grade bands — the rubric discriminates.

## Quick Start

```bash
# Install
npm install

# Run tests (22 tests)
npm test

# Score all assets from cached snapshots (no network)
npm run dev -- score all --from-snapshot

# Live probes + score (needs internet)
npm run dev -- probe all
npm run dev -- score all

# Publish dossiers on-chain (needs .env with keys)
npm run dev -- publish all --live

# Start REST API + frontend
npm run api
# → http://localhost:3000

# Build static site (no API dependency)
npm run build:site
# → dist/site/index.html

# MCP server (for Claude Code / MCP clients)
npm run mcp
```

## Project Structure

```
contracts/          Solidity — DossierRegistry.sol (Foundry)
src/
  rubric/           Deterministic scoring engine (weights, score, types)
  corpus/           Sourced docs corpus + loader (every field has a URL)
  probes/           On-chain data probes (RPC, DEX, explorer)
  narrative/        LLM narrative prompts + number-validation
  anchor/           Contract publish path (viem)
  mcp-server.ts     MCP server (3 tools)
  api.ts            REST API (node:http)
  cli.ts            CLI (probe, score, publish)
data/
  assets/           Structured docs corpus per asset
  snapshots/        Cached probe results (demo resilience)
  dossiers/         Canonical dossier JSON
  narratives/       Pre-generated + validated narratives
frontend/           Single-page dossier viewer
test/               Vitest tests (rubric, corpus, narrative)
```

## MCP Tools

| Tool | Description |
|---|---|
| `PROVENANCE_LIST` | List all rated assets with composite scores and grades |
| `PROVENANCE_GET_RATING` | Full risk dossier for a specific asset |
| `PROVENANCE_EXPLAIN` | Plain-English narrative explanation (number-validated) |

## Tech Stack

- **Engine:** TypeScript, Zod, Vitest
- **Chain:** Mantle Sepolia (5003), Solidity 0.8.24, Foundry
- **Client:** viem
- **Frontend:** vanilla HTML/CSS/JS, editorial dark theme (Syne + Space Grotesk + JetBrains Mono)
- **MCP:** @modelcontextprotocol/sdk
