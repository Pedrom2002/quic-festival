#!/usr/bin/env node
// Bundle-size budget checker. Runs after `next build`. Fails if any route's
// First Load JS exceeds the budget.
//
// Source of truth: `.next/build-manifest.json` + `.next/app-build-manifest.json`
// + per-route artefacts on disk.
//
// Why not @next/bundle-analyzer alone: that's an HTML report for humans;
// this is a CI gate that returns non-zero on regression.
//
// Budgets are intentionally generous — current admin route loads
// html5-qrcode + qrcode dynamically, public route loads framer-motion. Tune
// down once code-splitting tightens.

import { readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const NEXT_DIR = join(process.cwd(), ".next");

const BUDGETS_KB = {
  "/": 600,
  "/admin": 800,
  "/admin/scan": 1200, // html5-qrcode is heavy; bound by reality.
  "/admin/login": 500,
  "/confirmado/[token]": 500,
  "/privacidade": 300,
};

const HARD_CAP_KB = 1500;

function fileSizeKB(path) {
  if (!existsSync(path)) return 0;
  return Math.round(statSync(path).size / 1024);
}

function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function routeChunks(manifest, route) {
  const fromBuild = manifest?.pages?.[route] ?? [];
  return fromBuild;
}

function totalKB(chunks) {
  let total = 0;
  for (const chunk of chunks) {
    const path = join(NEXT_DIR, chunk);
    total += fileSizeKB(path);
  }
  return total;
}

function main() {
  const manifest = loadJson(join(NEXT_DIR, "build-manifest.json"));
  const appManifest = loadJson(join(NEXT_DIR, "app-build-manifest.json"));
  if (!manifest && !appManifest) {
    console.error("No build manifest found. Run `next build` first.");
    process.exit(1);
  }

  let failed = 0;
  const results = [];
  for (const [route, budget] of Object.entries(BUDGETS_KB)) {
    const pageChunks = routeChunks(manifest ?? {}, route);
    const appChunks = routeChunks(appManifest ?? {}, route);
    const chunks = [...new Set([...pageChunks, ...appChunks])];
    const size = totalKB(chunks);
    const status = size > budget ? "FAIL" : "OK";
    if (size > budget || size > HARD_CAP_KB) failed++;
    results.push({ route, size, budget, status });
  }

  console.log("Route                          Size(KB)  Budget(KB)  Status");
  console.log("------------------------------ --------- ----------- ------");
  for (const r of results) {
    console.log(
      `${r.route.padEnd(30)} ${String(r.size).padStart(9)} ${String(r.budget).padStart(11)}  ${r.status}`,
    );
  }

  if (failed > 0) {
    console.error(`\n${failed} route(s) exceed budget.`);
    process.exit(1);
  }
  console.log("\nAll routes within budget.");
}

main();
