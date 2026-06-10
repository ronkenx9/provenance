# PROVENANCE — flagship Mantle Turing Test submission (AI x RWA → Grand Champion)

AI ratings agency for tokenized assets: deterministic scoring engine + on-chain dossiers on
Mantle, machine-readable so agents can consume ratings.

## Read order (mandatory)
1. ~/brain/skills/hackathon-execution-framework.md — your operating contract
2. PRD.md — what and why
3. TASKS.md — what's next (first unchecked box)
4. ~/brain/projects/PROVENANCE.md — current state

## Verified facts (do not re-derive; re-verify if suspicious)
- Mantle Sepolia chain id = 5003 (NOT 5001). RPC https://rpc.sepolia.mantle.xyz
- ERC-8004 registry live on Sepolia: 0x8004A818BFB912233c491871b3d84c89A494BD9e (bytecode verified 2026-06-09)
- Reuse source: ../meridian (signals→probes, ledger→anchor, chains.ts already fixed)

## Verified asset addresses (Mantle mainnet 5000 — eth_getCode + symbol() checked 2026-06-10)
- mETH  `0xcDA86A272531e8640cD7F1a92c01839911B90bb0` (symbol=mETH)
  ⚠️ meridian's inherited `0xd5F7…ADfa` is the ETHEREUM L1 address — EMPTY on Mantle. Fixed here.
- USDY  `0x5bE26527e817998A7206475496fDE1E68957c5A6` (symbol=USDY)
- USDe  `0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34` (symbol=USDe)
- FBTC  `0xC96dE26018A54D51c097160568752c4E3BD6C364` (symbol=FBTC)

## Deployed addresses
- DossierRegistry: `0xd1534d20006248f4c2c290F83e6377b4A06037A9` (Mantle Sepolia 5003)
  - Deploy tx: `0x83600f9faa9a5216b6920f1aaa6e99a36ba8296a833788c83fd57905f8e074fe`
  - Deployer/Publisher: `0x093c1F3C6daA784376dF100e361F692DbB33acd8`
  - Sourcify verified: exact_match
  - Explorer: https://sepolia.mantlescan.xyz/address/0xd1534d20006248f4c2c290F83e6377b4A06037A9
