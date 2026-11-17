// Model instances are created once and reused. Note the deliberate split:
// the two privacy-critical steps use ONLY_ON_DEVICE, which throws rather than
// silently falling back to the cloud. That is the difference between a
// privacy guarantee and a privacy hope.
import { getGenerativeModel, InferenceMode } from "firebase/ai";
import { ai, loadRemoteConfig } from "./firebase.js";
import { redactionSchema, leakSchema } from "./schema.js";

let cachedCloudModel = "gemini-3.5-flash-lite";

export async function refreshModels() {
  const cfg = await loadRemoteConfig();
  cachedCloudModel = cfg.cloudModel;
  return cfg;
}

export function getRedactor() {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      promptOptions: { responseConstraint: redactionSchema }
    }
  });
}

export function getLeakChecker() {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      promptOptions: { responseConstraint: leakSchema }
    }
  });
}

// Structured output from the cloud too, so a hallucinated preamble can never
// be mistaken for redacted text.
export function getAnalyst() {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: cachedCloudModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            answer: { type: "string", nullable: false },
            next_actions: { type: "array", items: { type: "string" }, nullable: false }
          },
          required: ["answer", "next_actions"]
        }
      }
    }
  });
}

// Streaming text model, used for the optional plain-language pass.
export function getLocalExplainer() {
  return getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    inCloudParams: { model: cachedCloudModel }
  });
}
