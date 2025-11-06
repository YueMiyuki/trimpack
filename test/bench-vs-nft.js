#!/usr/bin/env node

/**
 * Benchmark: Compare trimpack traceDependencies vs @vercel/nft nodeFileTrace
 * Runs N rounds (default 50000) on a small entry file and reports timing.
 */

import { writeFileSync, unlinkSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { traceDependencies } from "../dist/core/dependency-tracer.js";
import { AssetAnalyzer } from "../dist/core/asset-analyzer.js";
import { nodeFileTrace } from "@vercel/nft";
import { tmpdir } from "node:os";
import { join } from "node:path";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
};

function info(msg) {
  console.log(`${colors.blue}[BENCH]${colors.reset} ${msg}`);
}

function success(msg) {
  console.log(`${colors.green}[RESULT]${colors.reset} ${msg}`);
}

async function main() {
  const rounds = Number(process.env.ROUNDS || 50000);
  const entry = join(tmpdir(), `.bench-entry-${process.pid}.js`);

  // Prepare a tiny entry file with builtins to keep runtime stable
  // Builtins are marked external in trimpack to match nft behavior
  writeFileSync(
    entry,
    `import fs from 'node:fs';\nimport path from 'node:path';\nexport const msg = 'hello';\nif (fs.existsSync('./package.json')) { path.resolve('./package.json'); }\n`,
  );

  info(`Entry: ${entry}`);
  info(`Rounds: ${rounds}`);

  // Warm-up both tools to mitigate first-run JIT / module load
  await traceDependencies(entry, { external: ["node:*"], concurrency: 256 });
  await new AssetAnalyzer({
    base: process.cwd(),
    external: ["node:*"],
    concurrency: 256,
    includeAssets: true,
  }).analyze(entry);
  await nodeFileTrace([entry], { base: process.cwd() });

  // Benchmark trimpack traceDependencies
  let start = performance.now();
  for (let i = 0; i < rounds; i++) {
    await traceDependencies(entry, { external: ["node:*"], concurrency: 256 });
  }
  const trimpackMs = performance.now() - start;

  // Benchmark trimpack AssetAnalyzer (asset engine)
  start = performance.now();
  for (let i = 0; i < rounds; i++) {
    const analyzer = new AssetAnalyzer({
      base: process.cwd(),
      external: ["node:*"],
      concurrency: 256,
      includeAssets: true,
    });
    await analyzer.analyze(entry);
  }
  const assetMs = performance.now() - start;

  // Benchmark @vercel/nft
  start = performance.now();
  for (let i = 0; i < rounds; i++) {
    await nodeFileTrace([entry], { base: process.cwd() });
  }
  const nftMs = performance.now() - start;

  const combinedMs = trimpackMs + assetMs;

  // Cleanup
  try {
    unlinkSync(entry);
  } catch {
    // ignore
  }

  // Report
  const perRoundTrimpack = trimpackMs / rounds;
  const perRoundAsset = assetMs / rounds;
  const perRoundNft = nftMs / rounds;

  success(
    `trimpack traceDependencies: ${trimpackMs.toFixed(2)}ms total, ${perRoundTrimpack.toFixed(4)}ms/round`,
  );
  success(
    `trimpack asset analyzer: ${assetMs.toFixed(2)}ms total, ${perRoundAsset.toFixed(4)}ms/round`,
  );
  success(
    `@vercel/nft nodeFileTrace: ${nftMs.toFixed(2)}ms total, ${perRoundNft.toFixed(4)}ms/round`,
  );

  const headToHead = combinedMs < nftMs ? "trimpack combined" : "@vercel/nft";
  const headToHeadRatio =
    combinedMs < nftMs ? nftMs / combinedMs : combinedMs / nftMs;
  info(
    `Total run time: ${headToHead} faster (~${headToHeadRatio.toFixed(2)}x)`,
  );
}

main().catch((err) => {
  console.error(`${colors.red}[ERROR]${colors.reset} ${err?.message || err}`);
  process.exit(1);
});
