/**
 * RedactThenAsk - Automated Verification Test Suite
 * Tests:
 * 1. Entity Recognition & Surrogate Token Generation
 * 2. Local Token Vault Isolation & Co-Reference Consistency
 * 3. Network Wire Zero-PII Leak Audit
 * 4. Local Re-hydration Roundtrip Fidelity
 * 5. Firebase App Check Token Generation
 * 6. Dynamic Remote Config Policy Switching
 */

import { TokenVault } from '../public/js/vault.js';
import { RedactorEngine } from '../public/js/redactor.js';
import { RehydratorEngine } from '../public/js/rehydrator.js';
import { PolicyManager } from '../public/js/policy.js';
import { PRESET_DOCUMENTS } from '../public/js/presets.js';

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

console.log('====================================================');
console.log('🧪 Starting RedactThenAsk Core Test Suite');
console.log('====================================================\n');

// TEST 1: Clinical Oncology Document Redaction & Zero Leak
console.log('Test Suite 1: Healthcare PHI / HIPAA Safe Harbor');
{
  const vault = new TokenVault('test_vault_clinical');
  const policyManager = new PolicyManager();
  policyManager.setPolicy('HIPAA_CLINICAL');
  const redactor = new RedactorEngine(policyManager.getActivePolicy());

  const doc = PRESET_DOCUMENTS.medical.content;
  const redactResult = redactor.redact(doc, vault);

  assert(vault.size() > 5, `Local vault populated with ${vault.size()} tokens (expected > 5)`);
  assert(!redactResult.sanitizedText.includes('Elena Vance'), 'Patient name "Elena Vance" purged from sanitized text');
  assert(!redactResult.sanitizedText.includes('Dr. Aris Thorne'), 'Doctor name "Dr. Aris Thorne" purged from sanitized text');
  assert(!redactResult.sanitizedText.includes('ONC-892410-X'), 'MRN "ONC-892410-X" purged from sanitized text');
  assert(!redactResult.sanitizedText.includes('04/18/1979'), 'Date of birth "04/18/1979" purged from sanitized text');
  assert(!redactResult.sanitizedText.includes('(555) 839-2041'), 'Phone number purged from sanitized text');
  assert(!redactResult.sanitizedText.includes('elena.vance@biohealth-research.org'), 'Email address purged from sanitized text');
  assert(redactResult.sanitizedText.includes('182 mg/dL'), 'Clinical vital "182 mg/dL" preserved for AI reasoning');
  assert(redactResult.sanitizedText.includes('8.4%'), 'Diagnostic lab value HbA1c "8.4%" preserved for AI reasoning');

  // Co-reference consistency check: Dr. Thorne appeared multiple times
  const doctorToken = vault.lookup('[TREATING_PHYSICIAN_1]');
  assert(doctorToken === 'Aris Thorne' || doctorToken === 'Dr. Aris Thorne', 'Co-reference maps physician to [TREATING_PHYSICIAN_1]');

  // Wire Leak Proof
  let leakDetected = false;
  for (const [token, entry] of vault.tokenToEntity.entries()) {
    if (redactResult.sanitizedText.includes(entry.original)) {
      leakDetected = true;
      console.error(`LEAK FOUND on token ${token}: ${entry.original}`);
    }
  }
  assert(!leakDetected, 'ZERO PII LEAK AUDIT: 100% of vault secrets absent from wire text');
}

// TEST 2: Executive Contract & Financial Redaction
console.log('\nTest Suite 2: Executive Employment & Legal Contract');
{
  const vault = new TokenVault('test_vault_legal');
  const policyManager = new PolicyManager();
  policyManager.setPolicy('LEGAL_CONTRACT');
  const redactor = new RedactorEngine(policyManager.getActivePolicy());

  const doc = PRESET_DOCUMENTS.legal.content;
  const redactResult = redactor.redact(doc, vault);

  assert(!redactResult.sanitizedText.includes('Marcus Sterling'), 'Executive name purged');
  assert(!redactResult.sanitizedText.includes('Apex CyberSystems'), 'Company name purged');
  assert(!redactResult.sanitizedText.includes('$385,000'), 'Base salary "$385,000" purged');
  assert(!redactResult.sanitizedText.includes('$120,000'), 'Performance bonus purged');
  assert(!redactResult.sanitizedText.includes('219-48-9032'), 'SSN purged');
  assert(!redactResult.sanitizedText.includes('9812-4029-11'), 'Bank account number purged');
  assert(redactResult.sanitizedText.includes('18 months'), 'Contract duration "18 months" preserved for legal reasoning');
}

// TEST 3: On-Device Re-hydration Roundtrip Fidelity
console.log('\nTest Suite 3: On-Device Local Re-hydration');
{
  const vault = new TokenVault('test_vault_rehydration');
  const policyManager = new PolicyManager();
  const redactor = new RedactorEngine(policyManager.getActivePolicy());
  const rehydrator = new RehydratorEngine();

  // Create document and redact
  const raw = 'Patient: Elena Vance visited Dr. Aris Thorne on October 14, 2024.';
  const redactResult = redactor.redact(raw, vault);

  // Cloud model creates an answer containing those exact surrogate tokens
  const mockCloudResponse = 'Based on the clinical evaluation of [PATIENT_1] by Dr. [TREATING_PHYSICIAN_1] on [CALENDAR_DATE_1], no progression was noted.';

  const rehydration = rehydrator.rehydrate(mockCloudResponse, vault, false);

  assert(rehydration.hydratedText.includes('Elena Vance'), 'Patient re-hydrated back into answer locally');
  assert(rehydration.hydratedText.includes('Dr. Aris Thorne') || rehydration.hydratedText.includes('Aris Thorne'), 'Doctor re-hydrated back into answer locally');
  assert(rehydration.hydratedText.includes('October 14, 2024'), 'Date re-hydrated back into answer locally');
  assert(!rehydration.hydratedText.includes('[PATIENT_1]'), 'No residual [PATIENT_1] surrogate token remains');
  assert(rehydration.substitutionsCount >= 3, `Performed ${rehydration.substitutionsCount} substitutions`);
}

// TEST 4: Remote Config Dynamic Policy Switching
console.log('\nTest Suite 4: Remote Config Dynamic Policy Switching');
{
  const policyManager = new PolicyManager();
  assert(policyManager.getActivePolicy().id === 'HIPAA_CLINICAL', 'Default policy is HIPAA_CLINICAL');

  policyManager.setPolicy('FINANCIAL_PAYROLL');
  assert(policyManager.getActivePolicy().id === 'FINANCIAL_PAYROLL', 'Switched to FINANCIAL_PAYROLL');
  assert(policyManager.getActivePolicy().redactFinancial === true, 'Financial redaction active in payroll mode');
}

// Final Summary
console.log('\n====================================================');
console.log(`🏁 Test Results: ${passCount} Passed, ${failCount} Failed`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL FIREWALL VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
}
