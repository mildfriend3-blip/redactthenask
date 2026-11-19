// The pipeline is the product. Four steps, three of which never touch the
// network, and one gate that can stop the only step that does.
import { getRedactor, getLeakChecker, getAnalyst } from "./models.js";
import { Vault } from "./vault.js";
import { redactPrompt, leakPrompt, analystPrompt } from "./prompts.js";
import { patternRedact, scanPatternLeaks } from "./patterns.js";

export const CHUNK_CHARS = 3500;

export function chunk(text, size = CHUNK_CHARS) {
  if (!text) return [];
  if (text.length <= size) return [text];
  const paragraphs = text.split(/\n{2,}/);
  const normalized = [];
  for (const p of paragraphs) {
    if (p.length <= size) {
      normalized.push(p);
    } else {
      // Hard split any paragraph longer than the window
      for (let i = 0; i < p.length; i += size) {
        normalized.push(p.slice(i, i + size));
      }
    }
  }

  const out = [];
  let cur = "";
  for (const p of normalized) {
    if (cur && (cur.length + p.length + 2) > size) {
      out.push(cur);
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function parseJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export function evaluateGate(gateResult) {
  if (!gateResult || typeof gateResult !== "object") {
    return { passed: false, leaks: ["unparseable gate response"] };
  }
  const rawLeaks = Array.isArray(gateResult.leaks) ? gateResult.leaks.filter(Boolean) : [];
  if (gateResult.verdict !== "CLEAN" || rawLeaks.length > 0) {
    const leaks = rawLeaks.length > 0
      ? rawLeaks
      : [`Gate verdict was ${gateResult.verdict || "SUSPECT"}`];
    return { passed: false, leaks };
  }
  return { passed: true, leaks: [] };
}

export async function runPipeline({ text, question, strictness = "standard", onStep }) {
  const vault = new Vault();
  const stats = { deviceCalls: 0, cloudCalls: 0, deviceMs: 0, cloudMs: 0, bytesUnsent: 0 };
  const t0 = performance.now();

  // ---- Step 1: redact, entirely on device --------------------------------
  onStep(0, "active", "reading locally, no network");

  // Deterministic pattern pass before on-device model
  const preRedacted = patternRedact(text, vault);
  const chunks = chunk(preRedacted.text);
  const safeParts = [];
  let lastSource = "ON_DEVICE";

  for (let i = 0; i < chunks.length; i++) {
    const t = performance.now();
    const res = await getRedactor().generateContent(redactPrompt(chunks[i], strictness));
    stats.deviceMs += performance.now() - t;
    stats.deviceCalls += 1;
    lastSource = res.response.inferenceSource || "ON_DEVICE";

    const parsed = parseJson(res.response.text());
    if (!parsed || typeof parsed.redacted_text !== "string") {
      onStep(0, "blocked", "on-device model returned malformed JSON");
      throw new Error("The on-device model could not redact this document. Try a shorter extract.");
    }
    vault.absorb(parsed.entities);
    safeParts.push(parsed.redacted_text.trim());
    onStep(0, "active", "chunk " + (i + 1) + " of " + chunks.length + " redacted");
  }

  const safeText = safeParts.join("\n\n");
  stats.bytesUnsent = Math.max(0, text.length - safeText.length);
  onStep(0, "done", chunks.length + " chunk(s) · " + Math.round(stats.deviceMs) + " ms · " + vault.size() + " identifiers replaced");

  // ---- Step 2: leak gate, on device, fail-closed -------------------------
  onStep(1, "active", "checking the redacted text for leftovers");

  // Deterministic audit pass
  const detLeaks = scanPatternLeaks(safeText);

  // Model-based audit pass
  const tGate = performance.now();
  const gate = await getLeakChecker().generateContent(leakPrompt(safeText));
  stats.deviceMs += performance.now() - tGate;
  stats.deviceCalls += 1;

  const rawGateResult = parseJson(gate.response.text());
  const gateEval = evaluateGate(rawGateResult);

  const combinedLeaks = [...new Set([...detLeaks, ...(!gateEval.passed ? gateEval.leaks : [])])];

  // Fail closed if either deterministic or model gate flagged an issue
  if (detLeaks.length > 0 || !gateEval.passed) {
    onStep(1, "blocked", "blocked: " + combinedLeaks.length + " possible identifier(s) left — nothing was sent");
    const err = new Error("Leak gate blocked the request: " + combinedLeaks.slice(0, 3).join(", "));
    err.blocked = true;
    err.leaks = combinedLeaks;
    throw err;
  }
  onStep(1, "done", "clean — cleared to leave the device");

  // ---- Step 3: reason in the cloud, over sanitised text only ------------
  onStep(2, "active", "asking the cloud model about the redacted text");
  const tCloud = performance.now();
  const res = await getAnalyst().generateContent(analystPrompt(safeText, question));
  stats.cloudMs += performance.now() - tCloud;
  stats.cloudCalls += 1;
  const cloudSource = res.response.inferenceSource || "IN_CLOUD";

  const answerJson = parseJson(res.response.text()) || { answer: res.response.text(), next_actions: [] };
  onStep(2, "done", Math.round(stats.cloudMs) + " ms · " + safeText.length + " chars sent");

  // ---- Step 4: restore names locally ------------------------------------
  onStep(3, "active", "putting your names back, on this device");
  const restoredAnswer = vault.restore(answerJson.answer || "");
  const restoredActions = (answerJson.next_actions || []).map((a) => vault.restore(a));
  onStep(3, "done", vault.size() + " placeholders restored locally");

  return {
    safeText,
    answer: restoredAnswer,
    nextActions: restoredActions,
    leaks: [],
    stats: { ...stats, totalMs: performance.now() - t0 },
    sources: { redact: lastSource, cloud: cloudSource },
    entityCount: vault.size()
  };
}
