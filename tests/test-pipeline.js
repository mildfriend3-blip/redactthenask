/**
 * RedactThenAsk - Core Guarantee Verification Test Suite
 *
 * NOTE: Model quality and on-device inference execution are not covered here,
 * because they require a real device with Chrome 139+ and Gemini Nano enabled.
 *
 * This test suite rigorously verifies the deterministic guarantees:
 * 1. Chunking boundaries & hard-splitting of oversized paragraphs (> 3500 chars)
 * 2. Robust JSON parsing and fallback extraction from model outputs
 * 3. Fail-closed leak gate decisions (blocking on any suspect verdict or non-empty leaks)
 * 4. In-memory Vault isolation, longest-token ordering, and round-trip restoration
 * 5. Deterministic pattern layer (emails, phone, PAN, IFSC, Aadhaar, cards, 11+ digits)
 * 6. Conservative preservation of legitimate dates, clinical vitals, and currency
 */

import { chunk, parseJson, evaluateGate, CHUNK_CHARS } from "../src/pipeline.js";
import { Vault } from "../src/vault.js";
import { patternRedact, scanPatternLeaks, PATTERN_RULES } from "../src/patterns.js";

let passCount = 0;
let failCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failCount++;
  }
}

console.log("====================================================");
console.log("🧪 RedactThenAsk Guarantee & Pipeline Test Suite");
console.log("   (Deterministic layers & fail-closed security)");
console.log("====================================================\n");

// -----------------------------------------------------------------------------
// 1. CHUNKING
// -----------------------------------------------------------------------------
console.log("Test Suite 1: Document Chunking & Hard-Splitting");
{
  const shortText = "Short single paragraph.";
  const c1 = chunk(shortText);
  assert(c1.length === 1 && c1[0] === shortText, "Short document returned as single chunk");

  const multiP = "Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.";
  const c2 = chunk(multiP);
  assert(c2.length === 1 && c2[0] === multiP, "Small multi-paragraph document merged under limit");

  // Oversized paragraph must be hard-split so Nano does not truncate
  const hugeText = "y".repeat(9000);
  const c3 = chunk(hugeText);
  assert(c3.length === 3, `9000-char wall of text split into 3 chunks (got ${c3.length})`);
  assert(c3.every((c) => c.length <= CHUNK_CHARS), `All chunks are <= ${CHUNK_CHARS} chars`);
  assert(c3.join("") === hugeText, "Hard split preserves complete original content without loss");

  // Mixed paragraphs with one giant paragraph in the middle
  const mixed = "Intro paragraph.\n\n" + "x".repeat(4000) + "\n\nOutro paragraph.";
  const c4 = chunk(mixed);
  assert(c4.every((c) => c.length <= CHUNK_CHARS), "Mixed document with oversized section stays within chunk limit");
}

// -----------------------------------------------------------------------------
// 2. JSON RECOVERY
// -----------------------------------------------------------------------------
console.log("\nTest Suite 2: Robust JSON Parsing & Extraction");
{
  const clean = '{"redacted_text": "safe", "entities": []}';
  const p1 = parseJson(clean);
  assert(p1 && p1.redacted_text === "safe", "Clean JSON parsed directly");

  const wrapped = 'Here is the response:\n```json\n{"verdict": "CLEAN", "leaks": []}\n```\nHope this helps!';
  const p2 = parseJson(wrapped);
  assert(p2 && p2.verdict === "CLEAN" && Array.isArray(p2.leaks), "Markdown-wrapped JSON successfully extracted");

  const invalid = "No valid JSON here whatsoever.";
  assert(parseJson(invalid) === null, "Invalid JSON safely returns null without throwing");

  assert(parseJson(null) === null, "Null input returns null");
}

// -----------------------------------------------------------------------------
// 3. FAIL-CLOSED LEAK GATE
// -----------------------------------------------------------------------------
console.log("\nTest Suite 3: Fail-Closed Leak Gate Decisions");
{
  // Clean verdict with empty leaks passes
  const g1 = evaluateGate({ verdict: "CLEAN", leaks: [] });
  assert(g1.passed === true && g1.leaks.length === 0, 'verdict: "CLEAN" + empty leaks passes');

  // CLEAN verdict with leaks must FAIL (fail-closed)
  const g2 = evaluateGate({ verdict: "CLEAN", leaks: ["john.doe@example.com"] });
  assert(g2.passed === false && g2.leaks.includes("john.doe@example.com"), 'verdict: "CLEAN" with non-empty leaks BLOCKS');

  // SUSPECT verdict with empty leaks must FAIL (fail-closed)
  const g3 = evaluateGate({ verdict: "SUSPECT", leaks: [] });
  assert(g3.passed === false && g3.leaks.length > 0, 'verdict: "SUSPECT" with empty leaks BLOCKS');

  // Malformed or null gate response must FAIL (fail-closed)
  const g4 = evaluateGate(null);
  assert(g4.passed === false, "Null gate response BLOCKS");

  const g5 = evaluateGate({});
  assert(g5.passed === false, "Empty object gate response BLOCKS");
}

// -----------------------------------------------------------------------------
// 4. VAULT ISOLATION & ROUND-TRIP RESTORATION
// -----------------------------------------------------------------------------
console.log("\nTest Suite 4: In-Memory Vault & Round-Trip Restoration");
{
  const vault = new Vault();
  vault.absorb([
    { type: "PERSON", placeholder: "[[PERSON_1]]", original: "Rohan" },
    { type: "PERSON", placeholder: "[[PERSON_10]]", original: "Rohan Mehta Senior" }
  ]);

  assert(vault.size() === 2, "Vault holds 2 registered tokens");
  assert(vault.has("[[PERSON_1]]"), "Vault has [[PERSON_1]]");
  assert(vault.has("[[PERSON_10]]"), "Vault has [[PERSON_10]]");

  // Longest token first check: [[PERSON_10]] must not be partially replaced by [[PERSON_1]]
  const modelOutput = "Recommendation for [[PERSON_10]] and [[PERSON_1]].";
  const restored = vault.restore(modelOutput);
  assert(restored === "Recommendation for Rohan Mehta Senior and Rohan.", "Longest token restored first without token collision");

  // Multiple occurrences
  const repeated = "Contact [[PERSON_1]] at [[PERSON_1]]'s office.";
  const restoredRepeated = vault.restore(repeated);
  assert(restoredRepeated === "Contact Rohan at Rohan's office.", "Multiple occurrences of token correctly substituted");
}

// -----------------------------------------------------------------------------
// 5. DETERMINISTIC PATTERN LAYER
// -----------------------------------------------------------------------------
console.log("\nTest Suite 5: Deterministic Pattern Redaction & Leak Audit");
{
  const vault = new Vault();
  const sampleDoc = [
    "Patient: contact aris.thorne@hospital-oncology.org or call +91 98765 43210.",
    "Identity: PAN ABCDE1234F, Aadhaar 1234-5678-9012, Card 4111-2222-3333-4444.",
    "Bank routing: IFSC HDFC0001234 and internal serial 9876543210123.",
    "Vitals: Blood sugar 182 mg/dL, HbA1c 8.4%, dose 1,05,000 units on 03-Nov-2026."
  ].join("\n");

  const redacted = patternRedact(sampleDoc, vault);

  // Sensitive entities must be purged
  assert(!redacted.text.includes("aris.thorne@hospital-oncology.org"), "Email redacted from text");
  assert(!redacted.text.includes("98765 43210"), "Phone number redacted from text");
  assert(!redacted.text.includes("ABCDE1234F"), "PAN redacted from text");
  assert(!redacted.text.includes("1234-5678-9012"), "Aadhaar number redacted from text");
  assert(!redacted.text.includes("4111-2222-3333-4444"), "Card number redacted from text");
  assert(!redacted.text.includes("HDFC0001234"), "IFSC redacted from text");
  assert(!redacted.text.includes("9876543210123"), "11+ digit ID run redacted from text");

  // Conservative check: numbers, dates, currency, and vitals must be PRESERVED
  assert(redacted.text.includes("182 mg/dL"), "Clinical metric 182 mg/dL preserved");
  assert(redacted.text.includes("8.4%"), "Clinical percentage 8.4% preserved");
  assert(redacted.text.includes("1,05,000"), "Currency / number 1,05,000 preserved");
  assert(redacted.text.includes("03-Nov-2026"), "Date 03-Nov-2026 preserved");

  // Vault must contain all extracted entities
  assert(vault.size() >= 7, `Vault absorbed ${vault.size()} deterministic entities`);

  // Scan safe text for residual leaks — should be 0
  const wireLeaks = scanPatternLeaks(redacted.text);
  assert(wireLeaks.length === 0, "Scan of redacted wire text reports ZERO leaks");

  // If un-redacted text is scanned, scanPatternLeaks MUST catch the leaks
  const leakedScan = scanPatternLeaks("Please reach out to test.leak@domain.com immediately.");
  assert(leakedScan.length > 0 && leakedScan[0].includes("Email address"), "scanPatternLeaks detects un-redacted email leak");

  // Roundtrip restoration verifies vault restores pattern values
  const restoredBack = vault.restore(redacted.text);
  assert(restoredBack.includes("aris.thorne@hospital-oncology.org"), "Email roundtrips accurately back through vault");
  assert(restoredBack.includes("ABCDE1234F"), "PAN roundtrips accurately back through vault");
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log("\n====================================================");
console.log(`🏁 Test Results: ${passCount} Passed, ${failCount} Failed`);
console.log("====================================================");

if (failCount > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL GUARANTEE TESTS PASSED SUCCESSFULLY!\n");
}
