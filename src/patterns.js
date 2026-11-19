// Deterministic pattern layer for high-confidence identifiers:
// - Emails
// - Indian mobile numbers (10 digits starting 6-9, optional +91/91/0 prefix)
// - PAN (Permanent Account Number: 5 uppercase letters, 4 digits, 1 uppercase letter)
// - IFSC (4 uppercase letters, 0, 6 alphanumeric characters)
// - Aadhaar-style (12 digits, 4-4-4 format)
// - Card-style (16 digits, 4-4-4-4 format)
// - Long ID runs (11+ consecutive digits)
//
// Conservative: preserves money (e.g. 1,05,000), dates (e.g. 03-Nov-2026, 2026-11-19),
// and clinical vitals/metrics.

export const PATTERN_RULES = [
  {
    type: "EMAIL",
    name: "Email address",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
  },
  {
    type: "PAN",
    name: "PAN number",
    regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g
  },
  {
    type: "IFSC",
    name: "IFSC code",
    regex: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g
  },
  {
    type: "CARD",
    name: "Payment card",
    regex: /\b(?:\d{4}[-\s]){3}\d{4}\b/g
  },
  {
    type: "AADHAAR",
    name: "Aadhaar number",
    regex: /\b\d{4}[-\s]\d{4}[-\s]\d{4}\b/g
  },
  {
    type: "PHONE",
    name: "Indian mobile number",
    regex: /(?:\+91[\-\s]?|91[\-\s]?|0)?[6-9]\d{4}[\-\s]?\d{5}\b/g
  },
  {
    type: "ID",
    name: "Long ID run",
    regex: /\b\d{11,}\b/g
  }
];

export function patternRedact(text, vault) {
  if (!text || typeof text !== "string") {
    return { text: "", entities: [] };
  }

  let out = text;
  const entities = [];
  const typeCounters = {};

  for (const rule of PATTERN_RULES) {
    // Reset regex state
    const rx = new RegExp(rule.regex.source, rule.regex.flags);
    const matches = [...out.matchAll(rx)];

    // Unique match values sorted longest first to avoid partial replacements
    const uniqueMatches = [...new Set(matches.map((m) => m[0]))].sort(
      (a, b) => b.length - a.length
    );

    for (const matchStr of uniqueMatches) {
      if (!typeCounters[rule.type]) typeCounters[rule.type] = 1;
      let placeholder = `[[${rule.type}_${typeCounters[rule.type]}]]`;
      while (vault && vault.has && vault.has(placeholder)) {
        typeCounters[rule.type]++;
        placeholder = `[[${rule.type}_${typeCounters[rule.type]}]]`;
      }
      typeCounters[rule.type]++;

      const entity = {
        type: rule.type,
        placeholder,
        original: matchStr
      };
      entities.push(entity);
      out = out.split(matchStr).join(placeholder);
    }
  }

  if (vault && typeof vault.absorb === "function") {
    vault.absorb(entities);
  }

  return { text: out, entities };
}

export function scanPatternLeaks(text) {
  if (!text || typeof text !== "string") return [];
  // Strip out valid placeholders so tokens like [[ID_1]] do not trigger patterns
  const stripped = text.replace(/\[\[[A-Z]+_\d+\]\]/g, " ");

  const leaks = [];
  for (const rule of PATTERN_RULES) {
    const rx = new RegExp(rule.regex.source, rule.regex.flags);
    const matches = stripped.match(rx);
    if (matches) {
      for (const m of matches) {
        leaks.push(`${rule.name}: ${m}`);
      }
    }
  }

  return [...new Set(leaks)];
}
