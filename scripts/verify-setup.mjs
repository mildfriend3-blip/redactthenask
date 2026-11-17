#!/usr/bin/env node
// Pre-flight check for RedactThenAsk.
//
//   node scripts/verify-setup.mjs
//
// Tells you exactly which Firebase setup step is still incomplete, before you
// waste time debugging a symptom that points somewhere else. Exit code 0 means
// the local config is complete; 1 means something blocking is missing.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const problems = [];
const warnings = [];
const passes = [];

function ok(msg) { passes.push(msg); }
function fail(msg) { problems.push(msg); }
function warn(msg) { warnings.push(msg); }

// ---------------------------------------------------------------- node
const major = Number(process.versions.node.split(".")[0]);
if (major >= 20) ok(`Node ${process.versions.node}`);
else fail(`Node ${process.versions.node} is too old - Vite 6 needs Node 20 or later.`);

// ---------------------------------------------------------------- .env
function parseEnv(text) {
  const out = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const REQUIRED = [
  "VITE_FB_API_KEY",
  "VITE_FB_AUTH_DOMAIN",
  "VITE_FB_PROJECT_ID",
  "VITE_FB_STORAGE_BUCKET",
  "VITE_FB_SENDER_ID",
  "VITE_FB_APP_ID",
  "VITE_RECAPTCHA_SITE_KEY"
];

const envPath = resolve(ROOT, ".env");
let env = {};

if (!existsSync(envPath)) {
  fail("No .env file. Run: cp .env.example .env, then fill it from Firebase console > Project settings > Your apps.");
} else {
  env = parseEnv(readFileSync(envPath, "utf8"));
  const missing = REQUIRED.filter((k) => !env[k] || !String(env[k]).trim());
  if (missing.length === 0) ok(`.env has all ${REQUIRED.length} required values`);
  else fail(`.env is missing or has empty: ${missing.join(", ")}`);
}

// ---------------------------------------------------------------- .firebaserc
const rcPath = resolve(ROOT, ".firebaserc");
let projectFromRc = null;
if (!existsSync(rcPath)) {
  fail(".firebaserc not found.");
} else {
  try {
    const rc = JSON.parse(readFileSync(rcPath, "utf8"));
    projectFromRc = rc?.projects?.default ?? null;
    if (!projectFromRc || projectFromRc === "YOUR_FIREBASE_PROJECT_ID") {
      fail('.firebaserc still holds the placeholder. Put your real project ID in projects.default.');
    } else {
      ok(`.firebaserc points at "${projectFromRc}"`);
    }
  } catch (err) {
    fail(`.firebaserc is not valid JSON: ${err.message}`);
  }
}

// ------------------------------------------------- project id consistency
if (projectFromRc && env.VITE_FB_PROJECT_ID && projectFromRc !== env.VITE_FB_PROJECT_ID) {
  fail(`Project mismatch: .firebaserc says "${projectFromRc}" but VITE_FB_PROJECT_ID says "${env.VITE_FB_PROJECT_ID}". Deploys will land in one project while the app talks to another.`);
}

// ---------------------------------------------------------------- sanity
if (env.VITE_FB_PROJECT_ID && !/^[a-z0-9-]{4,30}$/.test(env.VITE_FB_PROJECT_ID)) {
  warn("VITE_FB_PROJECT_ID does not look like a Firebase project ID (lowercase letters, digits, hyphens).");
}
if (env.VITE_FB_AUTH_DOMAIN && !env.VITE_FB_AUTH_DOMAIN.endsWith("firebaseapp.com")) {
  warn("VITE_FB_AUTH_DOMAIN usually ends in firebaseapp.com - double-check you copied authDomain, not a custom domain.");
}
if (env.VITE_RECAPTCHA_SITE_KEY && env.VITE_RECAPTCHA_SITE_KEY.startsWith("6L")) {
  ok("reCAPTCHA site key looks well-formed");
}

// ---------------------------------------------------------------- files
for (const f of ["firebase.json", "firestore.rules", "index.html", "src/pipeline.js"]) {
  if (existsSync(resolve(ROOT, f))) ok(`${f} present`);
  else fail(`${f} is missing - you are probably not in the repo root.`);
}

// ---------------------------------------------------------------- report
const line = "-".repeat(62);
console.log(`\nRedactThenAsk pre-flight\n${line}`);
for (const p of passes) console.log(`  PASS  ${p}`);
for (const w of warnings) console.log(`  WARN  ${w}`);
for (const p of problems) console.log(`  FAIL  ${p}`);
console.log(line);

if (problems.length === 0) {
  console.log("Local config is complete. Next:");
  console.log("  1. npm install && npm run dev");
  console.log("  2. In the browser console: self.FIREBASE_APPCHECK_DEBUG_TOKEN = true");
  console.log("     then register the printed token in App Check > Manage debug tokens.");
  console.log("  3. Confirm the device badge reads 'on-device: available'.\n");
  process.exit(0);
}

console.log(`${problems.length} blocking issue(s). See SETUP.md for the step-by-step runbook.\n`);
process.exit(1);
