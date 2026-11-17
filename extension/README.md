# RedactThenAsk Chrome Extension (Manifest V3)

A client-side privacy firewall extension that intercepts sensitive text when pasting into AI chatbots (**ChatGPT**, **Claude**, **Google Gemini**), swaps personal and confidential identifiers for surrogate tokens on your device, and re-hydrates responses locally.

---

## 🚀 Quick Setup Instructions

1. Open Google Chrome (or any Chromium browser like Brave, Edge, Arc).
2. In the URL bar, go to `chrome://extensions/`.
3. In the top right corner, toggle **"Developer mode"** to **ON**.
4. In the top left, click **"Load unpacked"**.
5. Select this directory:
   `/data/data/com.termux/files/home/redact-then-ask/extension`
6. You will see the **RedactThenAsk** icon appear in your Chrome toolbar!

---

## 🛡️ How It Works

### Option A: The Popup Clipboard Tool
1. Copy any sensitive text (e.g. medical report or salary slip) to your clipboard.
2. Click the **RedactThenAsk** icon in Chrome toolbar.
3. Click **"🛡️ Redact Clipboard & Copy Safe Text"**.
4. The extension extracts all entities into your **Local Token Vault** and replaces your clipboard with sanitized surrogate tokens (e.g. `[PATIENT_1]`, `[TREATING_PHYSICIAN_1]`, `[MONETARY_AMOUNT_1]`).
5. Paste into ChatGPT or Claude and ask your question.
6. Copy the AI's response.
7. Click **"✨ Re-hydrate Answer from Clipboard"** in the extension popup — the real names and numbers will be restored in your clipboard!

### Option B: The Floating In-Page Shield
1. Go to `https://chatgpt.com`, `https://claude.ai`, or `https://gemini.google.com`.
2. Notice the green **🛡️ Redact** badge in the bottom-right corner.
3. Paste your sensitive document into the chat input.
4. Click the badge — your text is instantly tokenized in-place, and the secrets are locked inside your local browser vault!
