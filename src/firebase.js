// One Firebase entry point. Everything is defensive: a missing App Check
// token or a failed Remote Config fetch must not take the app down, because
// the privacy-critical path (redaction) runs locally and always works.
import { initializeApp } from "firebase/app";
import { getAI, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getRemoteConfig, fetchAndActivate, getValue } from "firebase/remote-config";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// App Check is required by Firebase AI Logic. Debug tokens are accepted by
// the hackathon rules; register yours in the Firebase console and paste it
// into the browser console once:  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
try {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY || ""),
    isTokenAutoRefreshEnabled: true
  });
} catch (err) {
  console.warn("[appcheck] not initialised:", err.message);
}

export const ai = getAI(app, { backend: new GoogleAIBackend() });

// Remote Config lets us retune the redaction policy and pick the cloud model
// without shipping a new build. Defaults matter: the app must behave
// correctly with the network down.
const rc = getRemoteConfig(app);
rc.settings.minimumFetchIntervalMillis = 60 * 60 * 1000;
rc.defaultConfig = {
  cloud_model: "gemini-3.5-flash-lite",
  redact_strictness: "standard"
};

export async function loadRemoteConfig() {
  try {
    await fetchAndActivate(rc);
  } catch (err) {
    console.warn("[remote-config] using defaults:", err.message);
  }
  return {
    cloudModel: getValue(rc, "cloud_model").asString() || "gemini-3.5-flash-lite",
    strictness: getValue(rc, "redact_strictness").asString() || "standard"
  };
}

export async function ensureSignedIn() {
  return new Promise((resolve) => {
    const off = onAuthStateChanged(auth, (user) => {
      if (user) { off(); resolve(user); }
    });
    signInAnonymously(auth).catch((err) => {
      console.warn("[auth] anonymous sign-in failed:", err.message);
      off();
      resolve(null);
    });
  });
}

// Returns true when the browser can actually run Gemini Nano locally.
// This is the single most important check in the app: if it is false, the
// privacy promise is a lie, so the UI must say so out loud.
export async function deviceStatus() {
  const hasApi = typeof self !== "undefined" && "LanguageModel" in self;
  if (!hasApi) {
    return { ok: false, state: "no-prompt-api", detail: "Chrome 139+ on desktop is required for on-device inference." };
  }
  try {
    const availability = await self.LanguageModel.availability();
    if (availability === "unavailable") {
      return { ok: false, state: "unavailable", detail: "This machine does not meet the on-device requirements." };
    }
    return { ok: true, state: availability, detail: "Gemini Nano is " + availability + "." };
  } catch (err) {
    return { ok: false, state: "error", detail: err.message };
  }
}

// The exact call shape for warming the on-device model has moved between
// SDK versions, so support both. Must be called from a user gesture.
export async function ensureDeviceModel() {
  try {
    const mod = await import("firebase/ai");
    if (typeof ai.initializeDeviceModel === "function") {
      await ai.initializeDeviceModel();
      return true;
    }
    if (typeof mod.initializeDeviceModel === "function") {
      await mod.initializeDeviceModel(ai);
      return true;
    }
  } catch (err) {
    console.warn("[on-device] initialisation skipped:", err.message);
  }
  return false;
}

export { InferenceMode };
