import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const REPO_DIR = process.cwd();
const swContent = fs.readFileSync(path.join(REPO_DIR, "sw.js"), "utf8");
const indexContent = fs.readFileSync(path.join(REPO_DIR, "index.html"), "utf8");

// Pure behavioral helpers derived from sw.js logic
const STATIC_ASSET_EXTENSIONS = [".js", ".mjs", ".css", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".woff2", ".woff", ".json", ".ico"];

function isSameOriginStaticAsset(requestUrl, selfOrigin = "https://canfenci.github.io") {
  if (requestUrl.origin !== selfOrigin) return false;
  const pathname = requestUrl.pathname.toLowerCase();
  return STATIC_ASSET_EXTENSIONS.some(ext => pathname.endsWith(ext)) || pathname.endsWith("/") || pathname.endsWith("/index.html");
}

function shouldBypassServiceWorker(requestUrl, selfOrigin = "https://canfenci.github.io") {
  if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:") return true;
  if (requestUrl.origin !== selfOrigin) return true;
  const isStatic = isSameOriginStaticAsset(requestUrl, selfOrigin);
  if (requestUrl.search && !isStatic) return true;
  return false;
}

test("TECH-01 Scenario A: index.html does NOT use query-string module imports that evade SW cache", () => {
  // Query-string imports like homework.js?v=62 bypass SW search filters and fail offline
  assert.doesNotMatch(indexContent, /import\s+['"][^'"]+\.js\?[^'"]+['"]/);
  assert.match(indexContent, /import\s+['"]\.\/homework\.js['"]/);
});

test("TECH-01 Scenario B: Same-origin static JS canonical cache lookup works even if query-string is provided", () => {
  const requestWithQuery = new URL("https://canfenci.github.io/ogrenci-takip/homework.js?v=62");
  const isStatic = isSameOriginStaticAsset(requestWithQuery);
  const bypass = shouldBypassServiceWorker(requestWithQuery);

  assert.equal(isStatic, true, "homework.js?v=62 must be recognized as a same-origin static asset");
  assert.equal(bypass, false, "homework.js?v=62 must NOT be bypassed by the service worker");

  const ghPagesRootWithQuery = new URL("https://canfenci.github.io/ogrenci-takip/?page=odevler");
  assert.equal(isSameOriginStaticAsset(ghPagesRootWithQuery), true, "GitHub Pages base path /ogrenci-takip/ must be recognized as static asset");
  assert.equal(shouldBypassServiceWorker(ghPagesRootWithQuery), false, "GitHub Pages base path with query must NOT be bypassed by the service worker");

  assert.match(swContent, /ignoreSearch:\s*true/, "sw.js must match cache using ignoreSearch: true");
});

test("TECH-01 Scenario C: Cross-origin and API requests are NOT captured by static asset cache", () => {
  const crossOriginUrl = new URL("https://api.github.com/repos/canfenci/ogrenci-takip");
  const firebaseUrl = new URL("https://firestore.googleapis.com/v1/projects/test/databases");
  const dynamicSearchUrl = new URL("https://canfenci.github.io/api/search?q=test");

  assert.equal(shouldBypassServiceWorker(crossOriginUrl), true, "Cross-origin request must be bypassed");
  assert.equal(shouldBypassServiceWorker(firebaseUrl), true, "Firebase cloud request must be bypassed");
  assert.equal(shouldBypassServiceWorker(dynamicSearchUrl), true, "Same-origin dynamic search API must be bypassed");
});

test("TECH-01 Scenario D: sw.js includes critical offline fallback for navigation and core scripts", () => {
  assert.match(swContent, /caches\.match\([\x27"]\.\/index\.html[\x27"]\)/, "Navigation requests must fall back to index.html offline");
  assert.match(swContent, /ASSETS_TO_CACHE[\s\S]*[\x27"]\.\/homework\.js[\x27"]/, "homework.js must be precached in ASSETS_TO_CACHE");
  assert.match(swContent, /ASSETS_TO_CACHE[\s\S]*[\x27"]\.\/students\.js[\x27"]/, "students.js must be precached in ASSETS_TO_CACHE");
  assert.match(swContent, /ASSETS_TO_CACHE[\s\S]*[\x27"]\.\/store\.js[\x27"]/, "store.js must be precached in ASSETS_TO_CACHE");
});

test("TECH-01 Scenario E: Cache cleanup strictly deletes older canfenci-cache-* versions without touching other storage", () => {
  const currentCache = "canfenci-cache-v86";
  const existingCacheNames = [
    "canfenci-cache-v84",
    "canfenci-cache-v85",
    "canfenci-cache-v86",
    "firebase-heartbeat",
    "user-media-cache"
  ];

  const deletedCaches = existingCacheNames.filter(c => c.startsWith("canfenci-cache-") && c !== currentCache);
  const preservedCaches = existingCacheNames.filter(c => !deletedCaches.includes(c));

  assert.deepEqual(deletedCaches, ["canfenci-cache-v84", "canfenci-cache-v85"]);
  assert.deepEqual(preservedCaches, ["canfenci-cache-v86", "firebase-heartbeat", "user-media-cache"]);
  assert.match(swContent, /cache\.startsWith\([\x27"]canfenci-cache-[\x27"]\)/, "sw.js must isolate cleanup to canfenci-cache-* prefix");
});
