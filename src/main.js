import { deviceStatus, ensureDeviceModel, ensureSignedIn, refreshModels } from "./firebase.js";
import { runPipeline } from "./pipeline.js";
import { SAMPLES } from "./samples.js";

const $ = (id) => document.getElementById(id);
const docEl = $("doc");
const qEl = $("q");
const runBtn = $("run");
const resetBtn = $("reset");
const sampleSel = $("sample");
const stepsEl = $("steps");
const payloadCard = $("payload-card");
const payloadEl = $("payload");
const answerCard = $("answer-card");
const answerEl = $("answer");
const answerSource = $("answer-source");

let deviceOk = false;

// ---------- boot ---------------------------------------------------------
(async function boot() {
  for (const s of SAMPLES) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    sampleSel.appendChild(opt);
  }

  const status = await deviceStatus();
  deviceOk = status.ok;
  const badge = $("device-badge");
  badge.textContent = deviceOk
    ? "on-device: " + status.state
    : "on-device unavailable";
  badge.className = "badge" + (deviceOk ? "" : " warn");
  $("doc-hint").textContent = deviceOk
    ? "Redaction runs on this device. Only the redacted text is ever sent."
    : "This browser cannot run Gemini Nano, so redaction would have to happen in the cloud — the app refuses rather than break its promise. (" + status.detail + ")";
  $("doc-hint").className = "hint" + (deviceOk ? "" : " warn");
  runBtn.disabled = !deviceOk;

  try {
    await refreshModels();
  } catch { /* defaults are fine */ }

  const user = await ensureSignedIn();
  $("auth-badge").textContent = user ? "auth: " + user.uid.slice(0, 6) : "auth: off";
})();

// ---------- ui helpers ---------------------------------------------------
function setStep(i, state, detail) {
  const li = stepsEl.querySelector('[data-step="' + i + '"]');
  if (!li) return;
  li.classList.remove("active", "done", "blocked");
  if (state) li.classList.add(state);
  if (detail) li.querySelector("p").textContent = detail;
}

function resetSteps() {
  for (let i = 0; i < 4; i++) setStep(i, "", "—");
  payloadCard.hidden = true;
  answerCard.hidden = true;
}

function highlightTokens(el, text) {
  el.textContent = "";
  const parts = String(text).split(/(\[\[[A-Z]+_\d+\]\])/g);
  for (const p of parts) {
    if (/^\[\[[A-Z]+_\d+\]\]$/.test(p)) {
      const span = document.createElement("span");
      span.className = "tok";
      span.textContent = p;
      el.appendChild(span);
    } else {
      el.appendChild(document.createTextNode(p));
    }
  }
}

function formatBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(2) + " MB";
}

// ---------- interactions -------------------------------------------------
sampleSel.addEventListener("change", () => {
  const s = SAMPLES.find((x) => x.id === sampleSel.value);
  if (s) docEl.value = s.text;
});

$("toggle-payload").addEventListener("click", () => {
  const shown = payloadEl.style.display !== "none";
  payloadEl.style.display = shown ? "none" : "block";
  $("toggle-payload").textContent = shown ? "show" : "hide";
});

resetBtn.addEventListener("click", () => {
  docEl.value = "";
  resetSteps();
});

runBtn.addEventListener("click", async () => {
  const text = docEl.value.trim();
  const question = qEl.value.trim() || "What are the main risks here, and what should I do next?";
  if (!text) { docEl.focus(); return; }

  runBtn.disabled = true;
  resetSteps();

  // Warming the model must happen inside the click gesture.
  await ensureDeviceModel();

  try {
    const result = await runPipeline({ text, question, onStep: setStep });

    highlightTokens(payloadEl, result.safeText);
    payloadCard.hidden = false;

    answerEl.textContent = result.answer;
    if (result.nextActions.length) {
      const ul = document.createElement("ul");
      for (const a of result.nextActions) {
        const li = document.createElement("li");
        li.textContent = a;
        ul.appendChild(li);
      }
      answerEl.appendChild(document.createElement("br"));
      answerEl.appendChild(ul);
    }
    answerSource.textContent = result.sources.cloud === "ON_DEVICE" ? "on device" : "cloud";
    answerSource.className = "badge ghost" + (result.sources.cloud === "ON_DEVICE" ? "" : " cloud");
    answerCard.hidden = false;

    $("stat-device").textContent = result.stats.deviceCalls;
    $("stat-cloud").textContent = result.stats.cloudCalls;
    $("stat-unsent").textContent = formatBytes(result.stats.bytesUnsent);
    $("stat-latency").textContent = Math.round(result.stats.totalMs) + " ms";
    $("stat-entities").textContent = result.entityCount;
  } catch (err) {
    if (!err.blocked) {
      console.error(err);
      setStep(0, "blocked", err.message);
    }
    answerCard.hidden = false;
    answerEl.textContent = err.blocked
      ? "Blocked before anything left this device.\n\n" + err.message
      : "Could not finish: " + err.message;
    answerSource.textContent = "no request sent";
    answerSource.className = "badge warn";
  } finally {
    runBtn.disabled = !deviceOk;
  }
});
