// Shared response schemas.
// The same schema object is used twice: as `responseConstraint` for the
// on-device model and as `responseSchema` for the cloud model, so both
// return the same shape and the pipeline never branches on output format.
import { Schema } from "firebase/ai";

const ENTITY_TYPES = [
  "PERSON",
  "ORG",
  "PHONE",
  "EMAIL",
  "ADDRESS",
  "ID",
  "DOB",
  "OTHER"
];

export const redactionSchema = Schema.object({
  properties: {
    redacted_text: Schema.string(),
    entities: Schema.array({
      items: Schema.object({
        properties: {
          type: Schema.enumString({ enum: ENTITY_TYPES }),
          placeholder: Schema.string(),
          original: Schema.string()
        }
      })
    })
  }
});

export const leakSchema = Schema.object({
  properties: {
    verdict: Schema.enumString({ enum: ["CLEAN", "SUSPECT"] }),
    leaks: Schema.array({ items: Schema.string() })
  }
});
