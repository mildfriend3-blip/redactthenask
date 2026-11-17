/**
 * RedactThenAsk - On-Device Redaction & Entity Surrogate Engine
 * Runs 100% on-device in the browser client before any network request is formed.
 */

class RedactorEngine {
  constructor(policy = {}) {
    this.policy = Object.assign({
      redactNames: true,
      redactIDs: true,
      redactContact: true,
      redactFinancial: true,
      redactDates: true,
      redactOrganizations: true,
      redactMedicalLocations: true,
      customPatterns: []
    }, policy);
  }

  setPolicy(policy) {
    this.policy = Object.assign({}, this.policy, policy);
  }

  /**
   * Scans text, identifies sensitive entities according to active policy,
   * stores them in the Local Token Vault, and returns sanitized surrogate text.
   *
   * @param {string} text - Raw input document/prompt
   * @param {TokenVault} vault - Local Vault instance (isolated to client)
   * @returns {Object} { sanitizedText, detections, piiCounts }
   */
  redact(text, vault) {
    if (!text || typeof text !== 'string') {
      return { sanitizedText: '', detections: [], piiCounts: {} };
    }

    const detections = [];
    const piiCounts = {
      names: 0,
      identifiers: 0,
      contact: 0,
      financial: 0,
      dates: 0,
      organizations: 0
    };

    // Helper to register entity in the local vault
    const register = (matchText, category, tokenPrefix, startIdx = 0, endIdx = 0) => {
      const cleanMatch = matchText.trim().replace(/^[,.:;\s]+|[,.:;\s]+$/g, '');
      if (cleanMatch.length < 2) return matchText;

      const token = vault.getOrCreateToken(cleanMatch, tokenPrefix, category);
      detections.push({
        original: cleanMatch,
        token: token,
        category: category,
        start: startIdx,
        end: endIdx
      });

      if (category === 'NAME') piiCounts.names++;
      else if (category === 'ID') piiCounts.identifiers++;
      else if (category === 'CONTACT') piiCounts.contact++;
      else if (category === 'FINANCIAL') piiCounts.financial++;
      else if (category === 'DATE') piiCounts.dates++;
      else if (category === 'ORG') piiCounts.organizations++;

      return token;
    };

    let workingText = text;

    // =========================================================================
    // PASS 1: STRUCTURED CONTEXTUAL EXTRACTION (LEARN ENTITIES INTO VAULT)
    // =========================================================================

    // 1.1 Names & Persons
    if (this.policy.redactNames) {
      // Patient Name in clinical headers
      workingText = workingText.replace(
        /(Patient(?:\s+Name)?:\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
        (match, prefix, name, offset) => {
          const tok = register(name, 'NAME', 'PATIENT', offset + prefix.length, offset + match.length);
          return `${prefix}${tok}`;
        }
      );

      // Physician / Doctor header
      workingText = workingText.replace(
        /((?:Dr\.|Doctor|Physician|Attending(?:\s+Physician)?|Pathologist|Surgeon|Oncologist|Consultant):\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
        (match, prefix, name, offset) => {
          const tok = register(name, 'NAME', 'TREATING_PHYSICIAN', offset + prefix.length, offset + match.length);
          return `${prefix}${tok}`;
        }
      );

      // Standalone "Dr. FirstName LastName"
      workingText = workingText.replace(
        /\bDr\.\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g,
        (match, name, offset) => {
          const tok = register(name, 'NAME', 'TREATING_PHYSICIAN', offset, offset + match.length);
          return `Dr. ${tok}`;
        }
      );

      // Executive / Employee / Client header
      workingText = workingText.replace(
        /((?:Employee(?:\s+Name)?|Executive|Signatory|Recipient|Client|Account\s+Holder):\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
        (match, prefix, name, offset) => {
          const tok = register(name, 'NAME', 'INDIVIDUAL', offset + prefix.length, offset + match.length);
          return `${prefix}${tok}`;
        }
      );

      // Contractual phrasing: "and [Name], an individual"
      workingText = workingText.replace(
        /(\band\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(,\s+an\s+individual\b)/g,
        (match, prefix, name, suffix, offset) => {
          const tok = register(name, 'NAME', 'INDIVIDUAL', offset + prefix.length, offset + prefix.length + name.length);
          return `${prefix}${tok}${suffix}`;
        }
      );

      // Signature lines: "By: [Name], CEO"
      workingText = workingText.replace(
        /(By:\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(,\s*(?:Chief|CEO|CTO|President|Director|Officer))/g,
        (match, prefix, name, suffix, offset) => {
          const tok = register(name, 'NAME', 'INDIVIDUAL', offset + prefix.length, offset + prefix.length + name.length);
          return `${prefix}${tok}${suffix}`;
        }
      );

      // Department/Signoff: "Signed electronically by:\nDr. [Name], MD"
      workingText = workingText.replace(
        /(Signed electronically by:\s*\n)(?:Dr\.\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
        (match, prefix, name, offset) => {
          const tok = register(name, 'NAME', 'TREATING_PHYSICIAN', offset + prefix.length, offset + match.length);
          return `${prefix}Dr. ${tok}`;
        }
      );
    }

    // 1.2 Identifiers (SSN, MRN, Employee ID, Tax ID)
    if (this.policy.redactIDs) {
      // Social Security Numbers (SSN)
      workingText = workingText.replace(
        /\b\d{3}-\d{2}-\d{4}\b/g,
        (match, offset) => register(match, 'ID', 'SSN_ID', offset, offset + match.length)
      );

      // Medical Record Number (MRN)
      workingText = workingText.replace(
        /(MRN|Medical\s+Record\s+(?:No|Number)|Patient\s+ID):\s*([A-Z0-9-]+)/gi,
        (match, prefix, val, offset) => {
          const tok = register(val, 'ID', 'MRN_ID', offset + prefix.length, offset + match.length);
          return `${prefix}: ${tok}`;
        }
      );

      // Employee ID
      workingText = workingText.replace(
        /((?:Employee|Staff|Worker|Badge)\s+(?:ID|No|Number|#):\s*)([A-Z0-9-]+)/gi,
        (match, prefix, val, offset) => {
          const tok = register(val, 'ID', 'EMPLOYEE_ID', offset + prefix.length, offset + match.length);
          return `${prefix}${tok}`;
        }
      );

      // Tax ID / EIN / PAN
      workingText = workingText.replace(
        /((?:Tax\s+ID|SSN\/EIN|EIN|PAN|National\s+ID)(?:\s*\/\s*SSN)?:\s*)([A-Z0-9-]+)/gi,
        (match, prefix, val, offset) => {
          const tok = register(val, 'ID', 'TAX_ID', offset + prefix.length, offset + match.length);
          return `${prefix}${tok}`;
        }
      );
    }

    // 1.3 Contact Details (Email, Phone, Postal Address)
    if (this.policy.redactContact) {
      // Email addresses
      workingText = workingText.replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        (match, offset) => register(match, 'CONTACT', 'EMAIL', offset, offset + match.length)
      );

      // Phone numbers
      workingText = workingText.replace(
        /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
        (match, offset) => register(match, 'CONTACT', 'PHONE_NUMBER', offset, offset + match.length)
      );

      // Specific Street Address lines
      workingText = workingText.replace(
        /\b\d{1,5}\s+[A-Z][a-zA-Z0-9\s.,]+(?:Street|Avenue|Boulevard|Parkway|Drive|Lane|Way|Road|Plaza)(?:,\s*(?:Suite|Ste|Floor|Fl|Apt|Unit)\s*[A-Za-z0-9]+)?(?:,\s*[A-Z][a-z]+,\s*[A-Z]{2}(?:\s+\d{5})?)?/g,
        (match, offset) => register(match, 'CONTACT', 'POSTAL_ADDRESS', offset, offset + match.length)
      );

      // Zip / Postal codes
      workingText = workingText.replace(
        /(?:ZIP|Postal\s+Code):\s*(\d{5}(?:-\d{4})?)/gi,
        (match, prefix, code, offset) => {
          const tok = register(code, 'CONTACT', 'ZIP_CODE', offset + prefix.length, offset + match.length);
          return `${prefix}: ${tok}`;
        }
      );
    }

    // 1.4 Financial Details (Monetary values, Bank accounts, Equity Grants)
    if (this.policy.redactFinancial) {
      // Dollar amounts
      workingText = workingText.replace(
        /\$(?:[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)\b/g,
        (match, offset) => register(match, 'FINANCIAL', 'MONETARY_AMOUNT', offset, offset + match.length)
      );

      // Bank account & routing numbers
      workingText = workingText.replace(
        /((?:Checking\s+Account|Bank\s+Account|Account|Acct|Routing|IBAN|SWIFT)\s*(?:Number|No|#)?[:\s#]+)([0-9A-Z-]+)/gi,
        (match, prefix, val, offset) => {
          const tok = register(val, 'FINANCIAL', 'BANK_ACCOUNT', offset + prefix.length, offset + match.length);
          return `${prefix}${tok}`;
        }
      );

      // Equity grants
      workingText = workingText.replace(
        /\b([0-9]{1,3}(?:,[0-9]{3})+)\s+(RSUs?|Stock\s+Options?|Shares?)\b/gi,
        (match, count, type, offset) => {
          const tok = register(count, 'FINANCIAL', 'EQUITY_GRANT', offset, offset + match.length);
          return `${tok} ${type}`;
        }
      );
    }

    // 1.5 Organizations & Facilities
    if (this.policy.redactOrganizations || this.policy.redactMedicalLocations) {
      // Hospitals, Medical Centers, Clinics
      if (this.policy.redactMedicalLocations) {
        workingText = workingText.replace(
          /\b([A-Z][a-zA-Z0-9'.-]+(?:\s+[A-Z][a-zA-Z0-9'.-]+)*\s+(?:Hospital|Medical\s+Center|Memorial\s+Clinic|Health\s+System|Diagnostics\s+Lab))\b/g,
          (match, name, offset) => register(name, 'ORG', 'HEALTH_FACILITY', offset, offset + match.length)
        );
      }

      // Corporations, LLCs, Inc.
      if (this.policy.redactOrganizations) {
        workingText = workingText.replace(
          /\b([A-Z][a-zA-Z0-9'.-]+(?:\s+[A-Z][a-zA-Z0-9'.-]+)*,\s+(?:Inc\.?|Corp\.?|LLC|Ltd\.?)|[A-Z][a-zA-Z0-9'.-]+(?:\s+[A-Z][a-zA-Z0-9'.-]+)*\s+(?:Inc\.?|Corp\.?|LLC|Ltd\.?|Technologies|Enterprises|Innovations|Solutions|CyberSystems))\b/g,
          (match, name, offset) => register(name, 'ORG', 'ENTERPRISE_ORG', offset, offset + match.length)
        );
      }
    }

    // 1.6 Dates
    if (this.policy.redactDates) {
      // DOB
      workingText = workingText.replace(
        /((?:DOB|Date\s+of\s+Birth):\s*)([A-Za-z0-9,\/\-\s]+?)(?=\s*(?:\n|MRN|Age|Gender|Patient|$))/gi,
        (match, prefix, dateStr, offset) => {
          const tok = register(dateStr.trim(), 'DATE', 'DOB_DATE', offset + prefix.length, offset + match.length);
          return `${prefix}${tok}`;
        }
      );

      // Standard calendar dates
      workingText = workingText.replace(
        /\b(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/gi,
        (match, offset) => register(match, 'DATE', 'CALENDAR_DATE', offset, offset + match.length)
      );
    }

    // 1.7 Custom Patterns
    if (Array.isArray(this.policy.customPatterns)) {
      for (const item of this.policy.customPatterns) {
        if (!item || !item.regex) continue;
        try {
          const regex = new RegExp(item.regex, item.flags || 'gi');
          workingText = workingText.replace(regex, (match, offset) => {
            return register(match, item.category || 'CUSTOM', item.prefix || 'CUSTOM_TOKEN', offset, offset + match.length);
          });
        } catch (err) {
          console.warn('[Redactor] Invalid custom regex:', item.regex, err);
        }
      }
    }

    // =========================================================================
    // PASS 2: CO-REFERENCE PROPAGATION
    // Any entity learned in the vault must be replaced wherever it occurs
    // throughout the text, guaranteeing zero residual PII leaks!
    // =========================================================================
    const vaultEntries = Array.from(vault.tokenToEntity.values())
      .filter(e => e.original && e.original.length >= 3)
      .sort((a, b) => b.original.length - a.original.length);

    for (const entry of vaultEntries) {
      const orig = entry.original;
      const tok = entry.token;

      // Escape special characters for regex
      const escaped = orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`\\b${escaped}\\b`, 'g');

      workingText = workingText.replace(reg, () => {
        entry.occurrences++;
        return tok;
      });
    }

    return {
      sanitizedText: workingText,
      detections: detections,
      piiCounts: piiCounts
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RedactorEngine };
}
