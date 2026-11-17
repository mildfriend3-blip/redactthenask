/**
 * RedactThenAsk - Remote Config & Policy Manager
 * Interfaces with Firebase Remote Config to dynamically load redaction policies,
 * sensitivity rules, and custom entity patterns.
 */

const DEFAULT_POLICIES = {
  HIPAA_CLINICAL: {
    id: 'HIPAA_CLINICAL',
    name: 'HIPAA Safe Harbor (Healthcare)',
    description: 'Strips all 18 HIPAA PHI identifiers (names, dates, MRN, facilities, contacts) while keeping medical vitals, lab values & clinical terminology intact for AI diagnostic reasoning.',
    version: '2.4.0',
    redactNames: true,
    redactIDs: true,
    redactContact: true,
    redactFinancial: false,
    redactDates: true,
    redactOrganizations: false,
    redactMedicalLocations: true,
    customPatterns: [
      { regex: '\\b(?:Ward|Room|Bed)\\s*#?:?\\s*([0-9A-Z-]+)\\b', category: 'LOCATION', prefix: 'HOSPITAL_ROOM' }
    ]
  },
  LEGAL_CONTRACT: {
    id: 'LEGAL_CONTRACT',
    name: 'Executive & Legal Contracts',
    description: 'Redacts signatory names, corporate counterparties, executive salaries, stock grants, and confidential covenants, while retaining legal clause structure.',
    version: '1.9.2',
    redactNames: true,
    redactIDs: true,
    redactContact: true,
    redactFinancial: true,
    redactDates: true,
    redactOrganizations: true,
    redactMedicalLocations: false,
    customPatterns: [
      { regex: '\\b(?:Project|Codename)\\s+([A-Z][a-zA-Z0-9_-]+)\\b', category: 'CONFIDENTIAL', prefix: 'PROPRIETARY_PROJECT' }
    ]
  },
  FINANCIAL_PAYROLL: {
    id: 'FINANCIAL_PAYROLL',
    name: 'Financial Paystub & Banking',
    description: 'Shields salary figures, net pay, bank routing/account numbers, SSN, and home address, while letting the AI reason over compensation structure and deductions.',
    version: '1.5.0',
    redactNames: true,
    redactIDs: true,
    redactContact: true,
    redactFinancial: true,
    redactDates: true,
    redactOrganizations: true,
    redactMedicalLocations: false,
    customPatterns: []
  },
  MAX_PARANOIA_GDPR: {
    id: 'MAX_PARANOIA_GDPR',
    name: 'Zero-Trust GDPR Maximum Shield',
    description: 'Strict paranoid redaction across all proper nouns, dates, monetary values, contact methods, and organizations.',
    version: '3.0.1',
    redactNames: true,
    redactIDs: true,
    redactContact: true,
    redactFinancial: true,
    redactDates: true,
    redactOrganizations: true,
    redactMedicalLocations: true,
    customPatterns: []
  }
};

class PolicyManager {
  constructor() {
    this.policies = Object.assign({}, DEFAULT_POLICIES);
    this.currentPolicyId = 'HIPAA_CLINICAL';
    this.lastFetched = null;
    this.remoteConfigStatus = 'DEFAULT_LOCAL';
  }

  getActivePolicy() {
    return this.policies[this.currentPolicyId] || this.policies.HIPAA_CLINICAL;
  }

  setPolicy(policyId) {
    if (this.policies[policyId]) {
      this.currentPolicyId = policyId;
      return true;
    }
    return false;
  }

  updateCustomPolicy(customSettings) {
    this.policies.CUSTOM = Object.assign({
      id: 'CUSTOM',
      name: 'Custom User Policy',
      description: 'User-configured privacy firewall rules.',
      version: 'user-defined',
      redactNames: true,
      redactIDs: true,
      redactContact: true,
      redactFinancial: true,
      redactDates: true,
      redactOrganizations: true,
      redactMedicalLocations: true,
      customPatterns: []
    }, customSettings);
    this.currentPolicyId = 'CUSTOM';
  }

  /**
   * Simulates/Executes Firebase Remote Config fetchAndActivate()
   */
  async syncFromRemoteConfig() {
    try {
      const res = await fetch('/api/config/redaction-policy');
      if (res.ok) {
        const data = await res.json();
        if (data && data.policies) {
          this.policies = Object.assign({}, DEFAULT_POLICIES, data.policies);
          this.remoteConfigStatus = 'FIREBASE_REMOTE_CONFIG_ACTIVE';
          this.lastFetched = new Date().toISOString();
          return { success: true, version: data.version, timestamp: this.lastFetched };
        }
      }
    } catch (err) {
      console.warn('[RemoteConfig] Falling back to bundled defaults:', err.message);
    }
    this.remoteConfigStatus = 'FALLBACK_LOCAL_DEFAULTS';
    return { success: false, status: this.remoteConfigStatus };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PolicyManager, DEFAULT_POLICIES };
}
export { PolicyManager, DEFAULT_POLICIES };
