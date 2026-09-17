import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const REPO_DIR = process.cwd();
const swPath = path.join(REPO_DIR, "sw.js");
const swContent = fs.readFileSync(swPath, "utf8");

// Parse ASSETS_TO_CACHE from sw.js
function extractAssetsToCache(content) {
  const match = content.match(/const\s+ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\];/);
  if (!match) throw new Error("Could not find ASSETS_TO_CACHE in sw.js");
  return match[1]
    .split(",")
    .map(line => line.trim())
    .filter(line => line.startsWith('"') || line.startsWith("'"))
    .map(entry => entry.replace(/['"]/g, "").trim());
}

// Parse active CACHE_NAME from sw.js
function extractActiveCacheName(content) {
  const match = content.match(/const\s+CACHE_NAME\s*=\s*["']([^"']+)["']/);
  if (!match) throw new Error("Could not find active CACHE_NAME in sw.js");
  return match[1];
}

test("PWA-OFFLINE-01: CACHE_NAME is updated to canfenci-cache-v87", () => {
  const activeCache = extractActiveCacheName(swContent);
  assert.equal(activeCache, "canfenci-cache-v87", "Active cache name must be bumped to canfenci-cache-v87");
  assert.notEqual(activeCache, "canfenci-cache-v86", "Active cache name must not remain at baseline v86");
});

test("PWA-OFFLINE-01: All assets listed in ASSETS_TO_CACHE physically exist in repository", () => {
  const assets = extractAssetsToCache(swContent);
  assert.ok(assets.length > 0, "ASSETS_TO_CACHE must not be empty");

  const missingFiles = [];
  for (const asset of assets) {
    if (asset === "./") {
      const indexPath = path.join(REPO_DIR, "index.html");
      if (!fs.existsSync(indexPath)) missingFiles.push(asset);
      continue;
    }
    const cleanPath = asset.replace(/^\.\//, "");
    const fullPath = path.join(REPO_DIR, cleanPath);
    if (!fs.existsSync(fullPath)) {
      missingFiles.push(asset);
    }
  }

  assert.deepEqual(missingFiles, [], `All pre-cached assets must exist on disk. Missing: ${missingFiles.join(", ")}`);
});

test("PWA-OFFLINE-01: All required Guidance & Coaching ES modules are included in ASSETS_TO_CACHE", () => {
  const assets = extractAssetsToCache(swContent);

  const requiredModules = [
    "./guidance.js",
    "./guidance-center-insights.js",
    "./guidance-student-insights.js",
    "./guidance-records.js",
    "./guidance-followup-insights.js",
    "./guidance-weekly-insights.js",
    "./guidance-report-insights.js",
    "./guidance-report-pdf.js",
    "./guidance-performance-insights.js",
    "./guidance-priority-score.js",
    "./guidance-coaching-dashboard.js",
    "./coaching-plan-progress.js",
    "./coaching-plan-history.js",
    "./coaching-plan-monthly-summary.js",
    "./coaching-plan-model.js"
  ];

  for (const mod of requiredModules) {
    assert.ok(assets.includes(mod), `ASSETS_TO_CACHE must contain required module: ${mod}`);
  }
});

test("PWA-OFFLINE-01: ASSETS_TO_CACHE has no duplicate entries", () => {
  const assets = extractAssetsToCache(swContent);
  const seen = new Set();
  const duplicates = [];

  for (const item of assets) {
    if (seen.has(item)) {
      duplicates.push(item);
    }
    seen.add(item);
  }

  assert.deepEqual(duplicates, [], `ASSETS_TO_CACHE must not contain duplicates: ${duplicates.join(", ")}`);
});

test("PWA-OFFLINE-01: ASSETS_TO_CACHE does NOT contain dynamic user data, credentials or API URLs", () => {
  const assets = extractAssetsToCache(swContent);
  for (const asset of assets) {
    assert.doesNotMatch(asset, /googleapis\.com/, "Must not precache Google APIs");
    assert.doesNotMatch(asset, /firestore/, "Must not precache Firestore endpoints");
    assert.doesNotMatch(asset, /\?/, "Precache list must not contain query strings");
    assert.doesNotMatch(asset, /token|password|secret|key/i, "Precache list must not contain credentials");
  }
});

test("PWA-OFFLINE-01: Service worker install event uses skipWaiting and allSettled resilient caching", () => {
  assert.match(swContent, /self\.addEventListener\(\s*["']install["']/);
  assert.match(swContent, /Promise\.allSettled/);
  assert.match(swContent, /self\.skipWaiting\(\)/);
});

test("PWA-OFFLINE-01: Service worker activate event uses clients.claim and deletes older canfenci-cache-* versions", () => {
  assert.match(swContent, /self\.addEventListener\(\s*["']activate["']/);
  assert.match(swContent, /self\.clients\.claim\(\)/);
  assert.match(swContent, /cache\.startsWith\(['"]canfenci-cache-['"]\)/);
  assert.match(swContent, /cache\s*!==\s*CACHE_NAME/);
});

test("PWA-OFFLINE-01: Simulated service worker cache lifecycle successfully stores all precached assets", async () => {
  const assets = extractAssetsToCache(swContent);
  const fakeCache = new Map();

  // Simulate cache.add by checking file readable
  for (const asset of assets) {
    const filePath = asset === "./" ? path.join(REPO_DIR, "index.html") : path.join(REPO_DIR, asset.replace(/^\.\//, ""));
    const content = fs.readFileSync(filePath);
    fakeCache.set(asset, { status: 200, size: content.byteLength });
  }

  assert.equal(fakeCache.size, assets.length, "All assets should be simulated-cached successfully");
  for (const asset of assets) {
    assert.equal(fakeCache.get(asset)?.status, 200);
    assert.ok((fakeCache.get(asset)?.size || 0) > 0, `Asset ${asset} must have non-zero size`);
  }
});
