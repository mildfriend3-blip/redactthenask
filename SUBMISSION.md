# RedactThenAsk — Devpost Submission

## Elevator Pitch
Ask anything about a sensitive document. Leak nothing. Hybrid on-device + cloud inference with Firebase AI Logic that redacts personal data locally on Chrome Gemini Nano before reasoning in the cloud.

---

## Inspiration
Every useful AI feature on private documents (medical lab reports, executive employment agreements, tax filings, legal contracts) forces an impossible trade-off:
1. **Cloud-only inference** delivers high-quality reasoning but causes a serious privacy violation by uploading unredacted sensitive records across the network.
2. **On-device-only inference** keeps the document local, but small 3-billion-parameter on-device models struggle to reason across complex multi-page contracts or clinical histories.
3. Server-side anonymization is an illusion — the sensitive document has already arrived at the remote server before it is sanitized.

We built **RedactThenAsk** to solve this with a true hybrid architecture: split the pipeline strictly by what each model class is best at, separated by a fail-closed privacy firewall.

---

## What It Does
RedactThenAsk operates a 4-step hybrid pipeline:

1. **Local Redaction (On-Device — Gemini Nano)**:
   The document never touches the network. Gemini Nano running locally via Chrome's Prompt API extracts names, emails, phones, IDs, and financial identifiers into an ephemeral in-memory vault, substituting them with structured surrogate tokens (e.g., `[[PERSON_1]]`, `[[EMAIL_1]]`). A deterministic pattern layer pre-redacts high-confidence patterns (PAN, Aadhaar, cards, IFSC, emails).
2. **Fail-Closed Leak Gate (On-Device — Gemini Nano + Regex)**:
   A second independent audit verifies the sanitized text before any packet leaves the browser. If a single unredacted identifier is found, or if the model verdict is anything other than `CLEAN`, the entire request is blocked immediately.
3. **Cloud Reasoning (Cloud — Firebase AI Logic & Gemini 2.5/3.5 Flash)**:
   Only the sanitized text leaves the device. The cloud model reasons over the anonymous document to answer questions and produce next actions, citing references without ever seeing personal data.
4. **Local Re-hydration (On-Device — Memory Vault)**:
   The client restores the original identifiers back into the final response text using longest-token substitution. The vault lives only in tab memory for the request duration and is never persisted, logged, or uploaded.

---

## Firebase Products Used
* **Firebase AI Logic (`firebase/ai`)**: Drives the hybrid inference pipeline using `InferenceMode.ONLY_ON_DEVICE` for redaction and auditing, and `InferenceMode.ONLY_IN_CLOUD` for reasoning.
* **App Check (`firebase/app-check`)**: Protects cloud inference quota and enforces app attestation with reCAPTCHA v3 and debug tokens.
* **Firebase Authentication (`firebase/auth`)**: Employs anonymous sign-in so stored records are cryptographically scoped to a local `uid` without requiring personal email addresses.
* **Cloud Firestore (`firebase/firestore`)**: Stores sanitized safe documents under `users/{uid}/redactedDocs` protected by strict security rules. Vault tokens and raw documents never touch the database.
* **Firebase Remote Config (`firebase/remote-config`)**: Dynamically configures the cloud model and redaction strictness without requiring client app rebuilds.
* **Firebase Hosting**: Deploys the static Vite web application with strict security headers (CSP, nosniff, frame-ancestors none).

---

## How We Built It
* **Frontend**: Lightweight Vite vanilla ES modules application with zero client-side framework overhead.
* **AI & Security**: Pure Firebase SDK (`firebase/ai`), Prompt API for Gemini Nano, strict JSON response schemas (`Schema.object`), and deterministic regex patterns.
* **Safety Guarantees**: Fail-closed gate logic, hard paragraph splitting for oversized documents (>3,500 chars), and 100% client-isolated token vaults.

---

## Challenges We Ran Into
* **Enforcing Genuine On-Device Constraints**: Ensuring `InferenceMode.ONLY_ON_DEVICE` throws on failure rather than silently degrading to cloud fallback.
* **Token Collision Prevention**: Designing vault restoration to process tokens longest-first so that `[[PERSON_10]]` is never corrupted by `[[PERSON_1]]`.
* **Conservative Deterministic Patterns**: Creating regex patterns for Indian identifiers (PAN, IFSC, Aadhaar, mobile numbers) that reliably catch sensitive data without corrupting dates (`03-Nov-2026`) or clinical vitals (`182 mg/dL`, `1,05,000`).

---

## Accomplishments We're Proud Of
* A comprehensive test suite with **36/36 passing automated unit tests** verifying chunking, JSON recovery, fail-closed gate decisions, vault fidelity, and leak auditing.
* Zero external server backend: completely serverless, client-first architecture running on Firebase Hosting.
* Zero dependency vulnerabilities (`npm audit --omit=dev` reports 0 vulnerabilities).

---

## What We Learned
* Small on-device models excel at pattern transformation and surrogate token substitution, while large cloud models excel at multi-hop reasoning over sanitized context. Combining them gives the best of both worlds.

---

## What's Next
* Direct multi-modal on-device redaction for PDF files and medical scans (JPEG/PNG) before text extraction.
* Chrome extension rebuilt with native on-device prompt API workers.
