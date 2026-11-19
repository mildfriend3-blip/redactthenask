// Model instances are created once and reused. Note the deliberate split:
// the two privacy-critical steps use ONLY_ON_DEVICE, which throws rather than
// silently falling back to the cloud. That is the difference between a
// privacy guarantee and a privacy hope.
import { getGenerativeModel, InferenceMode } from "firebase/ai";
import { ai, loadRemoteConfig } from "./firebase.js";
import { redactionSchema, leakSchema } from "./schema.js";

let cachedCloudModel = "gemini-3.5-flash-lite";
let redactorInstance = null;
let leakCheckerInstance = null;
let analystInstance = null;
let localExplainerInstance = null;

export async function refreshModels() {
  const cfg = await loadRemoteConfig();
  if (cfg.cloudModel && cfg.cloudModel !== cachedCloudModel) {
    cachedCloudModel = cfg.cloudModel;
    analystInstance = null;
    localExplainerInstance = null;
  }
  return cfg;
}

export function getRedactor() {
  if (!redactorInstance) {
    redactorInstance = getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: {
        promptOptions: { responseConstraint: redactionSchema }
      }
    });
  }
  return redactorInstance;
}

export function getLeakChecker() {
  if (!leakCheckerInstance) {
    leakCheckerInstance = getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: {
        promptOptions: { responseConstraint: leakSchema }
      }
    });
  }
  return leakCheckerInstance;
}

// Structured output from the cloud too, so a hallucinated preamble can never
// be mistaken for redacted text.
export function getAnalyst() {
  if (!analystInstance) {
    analystInstance = getGenerativeModel(ai, {
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
  return analystInstance;
}

// Streaming text model, used for the optional plain-language pass.
export function getLocalExplainer() {
  if (!localExplainerInstance) {
    localExplainerInstance = getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      inCloudParams: { model: cachedCloudModel }
    });
  }
  return localExplainerInstance;
}
