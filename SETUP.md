# Firebase setup runbook

Console steps for RedactThenAsk. Do them in this order; each step ends with a
check that tells you it actually worked before you move on.

Total time: about 20 minutes, most of it waiting for the Gemini Nano model
download in step 0.

---

## Step 0 - Check the machine first (2 minutes)

Do not create a Firebase project until this passes. If it fails, the app cannot
run its privacy-critical path on this machine and you need a different laptop.

Open Chrome, go to `chrome://settings/help`, confirm version **139 or higher**.

Then `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and set it to
**Enabled**, then restart Chrome.

Open DevTools (F12) on any https page, go to the Console tab, and run:

```js
await LanguageModel.availability();
```

- `available` - good, continue.
- `downloadable` - run `await LanguageModel.create()` and wait for the download
  to finish. It can take several minutes and needs a metered-free connection.
- `downloading` - wait, then check again.
- `unavailable` - this machine does not meet the requirements (16 GB RAM or 4 GB
  VRAM, 22 GB free disk). Stop and use another machine.

Check: the console returns one of the three good states, not `unavailable`.

---

## Step 1 - Create the project (3 minutes)

1. Go to https://console.firebase.google.com and click **Create a project**.
2. Name it `redactthenask`. Note the **project ID** it generates - it is usually
   the name plus a suffix, and it is what goes in `.firebaserc`.
3. Google Analytics: **off**. You do not need it and it adds a consent surface.

Check: the project dashboard loads and the project ID is visible under the
project name in the top left.

---

## Step 2 - Register the web app and get the config (3 minutes)

1. Project overview, click the **web** icon (`</>`) to add a web app.
2. Nickname `redactthenask-web`. Do **not** tick Firebase Hosting yet.
3. Copy the `firebaseConfig` object it shows.

You need seven values. Map them to `.env` like this:

| Firebase console key | `.env` variable |
|---|---|
| `apiKey` | `VITE_FB_API_KEY` |
| `authDomain` | `VITE_FB_AUTH_DOMAIN` |
| `projectId` | `VITE_FB_PROJECT_ID` |
| `storageBucket` | `VITE_FB_STORAGE_BUCKET` |
| `messagingSenderId` | `VITE_FB_SENDER_ID` |
| `appId` | `VITE_FB_APP_ID` |

Then put the project ID in `.firebaserc`:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

These six values are public by design - they ship inside the browser bundle of
every Firebase web app. They are safe to commit. What is **not** safe to commit
is a service account key or a `firebase login:ci` token; those go into GitHub
secrets only (step 8).

Check: `node scripts/verify-setup.mjs` stops complaining about missing config.

---

## Step 3 - Enable AI Logic (2 minutes)

1. In the left nav, **Build > AI Logic**. Click **Get started**.
2. Choose **Gemini Developer API** as the provider. This is the one with the free
   tier; the Vertex AI option needs billing enabled.
3. Accept the terms.

Check: the AI Logic page shows a dashboard rather than a "get started" prompt.

---

## Step 4 - Authentication (1 minute)

1. **Build > Authentication > Get started**.
2. **Sign-in method** tab, enable **Anonymous**.
3. Leave every other provider off.

Check: the Anonymous row shows **Enabled**.

Why anonymous: the app needs a uid so Firestore rules can scope stored redacted
documents to one browser. It never asks for an email, which is the point.

---

## Step 5 - Firestore (2 minutes)

1. **Build > Firestore Database > Create database**.
2. Pick the region closest to you - `asia-south1` (Mumbai) for India.
3. Start in **production mode**. Do not use test mode; the rules in this repo are
   already written and restrictive.

Then deploy the rules (this is the step people skip and then wonder why nothing
saves):

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

Check: the Firestore **Rules** tab shows the two `match` blocks from
`firestore.rules`, not the default `allow read, write: if false` boilerplate.

---

## Step 6 - App Check (3 minutes, the step that breaks everything if skipped)

Firebase AI Logic refuses requests without App Check. This is why the app looks
"broken" when everything else is configured.

1. **Build > App Check > Apps** tab, find your web app, click **Register**.
2. Choose **reCAPTCHA v3**.
3. You need a site key. In the [reCAPTCHA admin console](https://www.google.com/recaptcha/admin/create),
   create a v3 key, add domains `localhost` and `127.0.0.1`, and copy the **site
   key** (not the secret key).
4. Paste it into `.env` as `VITE_RECAPTCHA_SITE_KEY`.
5. For local development you also need a debug token. In the browser console on
   your dev page, run once:

```js
self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
```

Reload the page, and the console prints a debug token UUID. Go back to
**App Check > Apps > your app > Manage debug tokens**, add that UUID.

6. When you deploy, add the production domain to the reCAPTCHA key's allowed
   domains and to **App Check > Apps > your app**, or production will fail while
   localhost works.

Check: the browser console shows no `appCheck/` errors and the App Check
dashboard records a request after you load the app.

---

## Step 7 - Remote Config (2 minutes)

The app reads two parameters and falls back to hardcoded defaults if they are
missing, so this step is optional but it is one of the Firebase products the
submission claims to use - so do it.

**Engage > Remote Config**, add two parameters:

| Parameter | Type | Default value |
|---|---|---|
| `cloud_model` | String | `gemini-3.5-flash-lite` |
| `redact_strictness` | String | `standard` |

Click **Publish changes**.

Check: `npm run dev`, open the app, and the console logs no Remote Config error.

---

## Step 8 - GitHub secrets and the hosted URL (3 minutes)

The workflow at `.github/workflows/firebase-hosting.yml` builds and deploys on
every push to `main`. It needs eight repository secrets.

Get the deploy token locally:

```bash
firebase login:ci
```

Copy the printed token. Then in GitHub: **Settings > Secrets and variables >
Actions**, add:

- `FIREBASE_TOKEN` - the token from `firebase login:ci`
- `VITE_FB_API_KEY`, `VITE_FB_AUTH_DOMAIN`, `VITE_FB_PROJECT_ID`,
  `VITE_FB_STORAGE_BUCKET`, `VITE_FB_SENDER_ID`, `VITE_FB_APP_ID` - from step 2
- `VITE_RECAPTCHA_SITE_KEY` - from step 6

Push any commit to `main` and the **Actions** tab runs the deploy. It fails on
purpose if the Firebase config secrets are missing, rather than deploying an
empty build.

Check: the Actions run goes green and prints a `Hosting URL`. Open it, load the
app, and confirm the device badge reads `on-device: available`.

Then go back and add that Hosting domain to both the reCAPTCHA allowed domains
and App Check, or the deployed app fails while localhost works.

---

## Step 9 - The check that matters

On the deployed URL, with a sample loaded, press **Protect & ask**, then press
**show** on "Exactly what left your device". You should see your document with
`[[PERSON_1]]`-style tokens where names, phone numbers and IDs were, and the
original values nowhere in the payload.

Open DevTools > Network, filter to `generateContent`, and confirm the request
body contains only the redacted text.

That is the whole product working. Everything after this is polish.

---

## When it does not work

| Symptom | Cause |
|---|---|
| `appCheck/recaptcha-error` or 403 on AI calls | App Check not registered, or the debug token is not added (step 6) |
| `auth/operation-not-allowed` | Anonymous sign-in not enabled (step 4) |
| `Missing or insufficient permissions` on save | Firestore rules not deployed (step 5) |
| Device badge says `on-device unavailable` | Chrome flag off, Chrome under 139, or hardware short of 16 GB RAM / 22 GB disk (step 0) |
| On-device call hangs for minutes on first run | The model is downloading; that is the documented behaviour, not a bug |
| Cloud call fails with a model error | `cloud_model` in Remote Config names a model your API tier cannot use; delete the parameter to fall back to the default |
