import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import minimist from "minimist";
import chalk from "chalk";
import { ASSET_IDS, loadAssetDoc, toRubricInputs } from "./corpus/load.js";
import { probeAsset, toProbeData, type ProbeResult } from "./probes/asset-probe.js";
import { buildDossier } from "./rubric/score.js";
import { publishDossierOnChain } from "./anchor/publish.js";
import type { Dossier } from "./rubric/types.js";

const SNAP_DIR = join(process.cwd(), "data", "snapshots");

function snapPath(assetId: string) { return join(SNAP_DIR, `${assetId}.json`); }

async function getProbe(assetId: string, fromSnapshot: boolean): Promise<ProbeResult> {
  if (fromSnapshot) {
    if (!existsSync(snapPath(assetId))) throw new Error(`no snapshot for ${assetId} — run 'probe ${assetId}' first`);
    return JSON.parse(readFileSync(snapPath(assetId), "utf8")) as ProbeResult;
  }
  const doc = loadAssetDoc(assetId);
  const r = await probeAsset(assetId, doc.address as `0x${string}`, doc.symbol);
  mkdirSync(SNAP_DIR, { recursive: true });
  writeFileSync(snapPath(assetId), JSON.stringify(r, null, 2));
  return r;
}

function renderScore(assetId: string, probe: ProbeResult) {
  const doc = loadAssetDoc(assetId);
  const { inputs, notes } = toRubricInputs(doc, toProbeData(probe));
  const d = buildDossier(inputs);
  console.log(chalk.bold(`\n${doc.symbol} — composite ${d.composite} · grade ${chalk.yellow(d.grade)} (rubric v${d.rubricVersion})`));
  for (const dim of d.dimensions) {
    const head = dim.unknown ? chalk.dim(`${dim.dimension}: UNKNOWN (weight redistributed)`) : `${dim.dimension}: ${dim.score} (w ${dim.effectiveWeight}%)`;
    console.log("  " + head);
    for (const f of dim.factors) console.log(chalk.dim(`    · ${f}`));
  }
  if (d.flags.length) { console.log(chalk.red("  flags:")); for (const f of d.flags) console.log(chalk.red(`    ! ${f}`)); }
  const caveats = Object.entries(notes).filter(([, n]) => /PROXY|SECONDARY|CONSERVATIVE/i.test(n));
  if (caveats.length) { console.log(chalk.dim("  caveats:")); for (const [k, n] of caveats) console.log(chalk.dim(`    ~ ${k}: ${n}`)); }
  return d;
}

const args = minimist(process.argv.slice(2));
const [cmd, assetArg] = args._ as string[];
const fromSnapshot = Boolean(args["from-snapshot"]);

if (cmd === "probe") {
  const ids = assetArg ? [assetArg.toLowerCase()] : [...ASSET_IDS];
  for (const id of ids) {
    const r = await getProbe(id, false);
    console.log(chalk.bold(`\n${id.toUpperCase()} probe @ ${r.fetchedAt}`));
    console.log({ totalSupply: r.totalSupply, priceUsd: r.priceUsd, marketCapUsd: r.marketCapUsd, dexTvlUsd: r.dexTvlUsd, dexPoolCount: r.dexPoolCount, depthToExit100kBps: r.depthToExit100kBps, verifiedSourcify: r.contractsVerifiedSourcify, top10HolderPct: r.top10HolderPct });
    for (const n of r.notes) console.log(chalk.dim(`  ~ ${n}`));
  }
} else if (cmd === "score") {
  const ids = assetArg && assetArg !== "all" ? [assetArg.toLowerCase()] : [...ASSET_IDS];
  const results: { id: string; composite: number; grade: string }[] = [];
  for (const id of ids) {
    const d = renderScore(id, await getProbe(id, fromSnapshot));
    results.push({ id, composite: d.composite, grade: d.grade });
  }
  if (results.length > 1) {
    const max = Math.max(...results.map((r) => r.composite)), min = Math.min(...results.map((r) => r.composite));
    console.log(chalk.bold(`\nspread: ${(max - min).toFixed(1)} points · grades: ${[...new Set(results.map((r) => r.grade))].join("/")}`));
  }
} else if (cmd === "publish") {
  const registry = process.env.REGISTRY_ADDRESS as `0x${string}`;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
  if (!registry || !privateKey) { console.error("REGISTRY_ADDRESS and DEPLOYER_PRIVATE_KEY must be set in .env"); process.exit(1); }

  const ids = assetArg && assetArg !== "all" ? [assetArg.toLowerCase()] : [...ASSET_IDS];
  const live = Boolean(args["live"]);

  for (const id of ids) {
    const probe = await getProbe(id, true); // always from snapshot for reproducibility
    const doc = loadAssetDoc(id);
    const { inputs } = toRubricInputs(doc, toProbeData(probe));
    const dossier: Dossier = buildDossier(inputs);
    const dossierJson = JSON.stringify({ assetId: id, symbol: doc.symbol, ...dossier, probeSnapshot: probe }, null, 2);

    // Write canonical dossier JSON to data/dossiers/
    const dossierDir = join(process.cwd(), "data", "dossiers");
    mkdirSync(dossierDir, { recursive: true });
    writeFileSync(join(dossierDir, `${id}.json`), dossierJson);

    console.log(chalk.bold(`\n${doc.symbol} — ${dossier.composite} ${dossier.grade}`));

    if (live) {
      console.log(chalk.dim("  publishing on-chain..."));
      const result = await publishDossierOnChain({
        symbol: doc.symbol, dossier, dossierJson, registry, privateKey,
      });
      console.log(chalk.green(`  ✓ tx ${result.txHash}`));
      console.log(chalk.green(`    version ${result.version} · ${result.verifyUrl}`));
    } else {
      console.log(chalk.dim("  dry run (pass --live to broadcast)"));
      console.log(chalk.dim(`  dossier written to data/dossiers/${id}.json`));
    }
  }
} else {
  console.log(`usage:
  npm run dev -- probe [asset]            live probe (writes data/snapshots/<asset>.json)
  npm run dev -- score [asset|all] [--from-snapshot]
  npm run dev -- publish [asset|all] [--live]   publish dossiers on-chain`);
}
