# RedactThenAsk

**Ask anything about a sensitive document. Leak nothing.**

People paste lab reports, rental agreements and salary slips into chatbots because
they need the answer — and hand over their identity to get it. RedactThenAsk
removes the identity *before* the question ever leaves the device, gets a full
answer from a cloud model, then puts the names back locally.

Built with **Firebase AI Logic hybrid inference**: on-device Gemini Nano through
Chrome's Prompt API, falling back to cloud-hosted Gemini only where a cloud model
is genuinely required.

---

## The problem

Every useful AI feature on a private document forces a trade:

- **Cloud-only** gives a good answer and a privacy incident.
- **On-device-only** keeps the document private and gives you a weak answer,
  because a 3-billion-parameter model cannot reason across a 12-page contract.

Both options are unacceptable, and "we anonymise it server-side" is not an answer —
the document has already arrived on the server by then.

## The idea

Split the work by *what each model is good at*, not by what is convenient:

| Step | Where | Why there |
|---|---|---|
| **1. Redact** | On device | The raw document must never cross the network. Gemini Nano rewrites it into a safe version and returns the placeholder map as structured JSON. |
| **2. Leak gate** | On device | A second on-device pass audits the redacted text for identifiers that survived. If it finds any, the request is **blocked** — the cloud is never called. |
| **3. Reason** | Cloud | Only the sanitised text is sent. The cloud model is the only component that needs to be smart, and it never sees a name. |
| **4. Restore** | On device | Placeholders are substituted back from an in-memory vault. Deterministic string work, no model needed. |

The result: the cloud does the thinking, the device keeps the identity, and there
is a hard gate between them.

## Why this is genuinely hybrid, not hybrid as decoration

The two steps that carry the privacy guarantee use `InferenceMode.ONLY_ON_DEVICE`,
which **throws** rather than silently falling back to the cloud. That is the
difference between a privacy promise and a privacy hope. If the device cannot run
Nano, the app refuses to run the flow at all and says so in the UI.

The cloud step uses `ONLY_IN_CLOUD` because redaction quality is not the place to
be clever, and the reasoning step is where a small model would fail.

Every response carries `response.inferenceSource` (`ON_DEVICE` or `IN_CLOUD`), and
the UI displays it per step, so a judge can watch routing happen instead of taking
it on trust.

## Firebase products used

- **AI Logic** — hybrid inference, structured output on both device and cloud
- **App Check** — required by AI Logic; debug tokens work for local development
- **Authentication** — anonymous sign-in, so stored documents are scoped to a uid
- **Firestore** — stores redacted documents and user policy only; rules make the
  vault unreachable by design
- **Remote Config** — retunes the cloud model and redaction strictness without
  shipping a build; safe defaults mean the app works with the network down
- **Hosting** — the deployed demo

## Architecture

```
        ┌──────────────────────────── browser tab ────────────────────────────┐
        │                                                                     │
  raw   │  ① redact (ONLY_ON_DEVICE)      ② leak gate (ONLY_ON_DEVICE)        │
 doc ───┼──▶ Gemini Nano ──▶ safe text ──▶ Gemini Nano ──▶ CLEAN? ─┐          │
        │        │                                                     │      │
        │        └──▶ Vault { [[PERSON_1]] → "Rohan Mehta" }  (memory │      │
        │             only, never persisted, dies with the tab)        │      │
        │                                                              ▼      │
        │  ④ restore ◀── answer with placeholders ◀── ③ reason (ONLY_IN_CLOUD)│
        │        │                                            ▲               │
        └────────┼────────────────────────────────────────────┼───────────────┘
                 ▼                                            │
            your answer                          safe text only, over TLS
```

## Run it

### 1. Prerequisites

- Chrome **139+** on **desktop** (Windows, macOS, Linux or Chromebook Plus)
- **16 GB RAM** (or a GPU with 4 GB+ VRAM) and **22 GB free disk** for the model
- Node 20+

Check the machine before anything else. Open DevTools → Console:

```js
await LanguageModel.availability();   // want: "available" | "downloadable"
```

If it says `unavailable`, this app cannot demo honestly on that machine.

### 2. Enable the on-device model

1. `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` → **Enabled**
2. Restart Chrome
3. Optional but do it before recording: `await LanguageModel.create()` in the
   console and let the download finish (it can take several minutes)

### 3. Firebase project

```bash
npm create vite@latest   # not needed — this repo is already a Vite app
cp .env.example .env
```

In the Firebase console: create a project, add a **Web app**, enable
**Authentication → Anonymous**, create a **Firestore** database, enable
**AI Logic** with the Gemini Developer API, and register **App Check** with
reCAPTCHA v3.

Paste the web config values into `.env`. Put your project id in `.firebaserc`.

For local development, App Check will not have a real token. Register a debug
token instead:

```js
// in the browser console, once
self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
```

then add the printed token under **App Check → Apps → Manage debug tokens**.

### 4. Run

```bash
npm install
npm run dev        # http://localhost:5173
```

Pick a sample from the dropdown, press **Protect & ask**, then press **show** on
"Exactly what left your device". That panel is the whole argument.

### 5. Deploy

```bash
npm run build
firebase deploy --only hosting,firestore:rules
```

## Project layout

```
src/firebase.js    app, App Check, Auth, Firestore, Remote Config, AI, device check
src/models.js      the four model instances and their inference modes
src/schema.js      one schema used as responseConstraint (device) and responseSchema (cloud)
src/prompts.js     the three prompts — short and literal for Nano, reasoning for cloud
src/pipeline.js    the four-step flow, chunking, the blocking leak gate
src/vault.js       placeholder → original, in memory only
src/samples.js     three synthetic documents for the demo
src/main.js        UI wiring and the routing panel
```

## Design notes worth defending in the write-up

- **Chunking.** Nano has a small context. Documents are split on paragraph
  boundaries and redacted chunk by chunk, then merged, so a 10-page PDF does not
  silently truncate. Cloud gets the whole sanitised document.
- **The gate is a second opinion.** Asking the same model that did the redaction
  whether the redaction worked is weak, so the gate prompt is written as an
  independent audit with a different task and its own schema.
- **Restore is not an AI step.** Substituting `[[PERSON_1]]` back is a string
  operation. Using a model there would add latency and a failure mode for nothing.
- **The vault never persists.** No localStorage, no Firestore, no logs. Closing
  the tab destroys the mapping, which is why the server can never reconstruct the
  document even with full database access.
- **Fail closed.** No Prompt API → the run button is disabled with an explanation,
  rather than quietly degrading to cloud redaction and breaking the promise.

## Status and scope

This is a hackathon starter: the four-step pipeline, the leak gate, the vault,
structured output on both model classes, and the routing panel are implemented.
Not yet wired: PDF and image ingestion (Nano accepts JPEG/PNG inline, cloud takes
PDFs), saved-document history in Firestore, and the Android client.

## License

MIT — see `LICENSE`. The hackathon prefers Apache-2.0; swap the file for
`https://www.apache.org/licenses/LICENSE-2.0.txt` if you want that instead, and
update the `license` field in `package.json`.
