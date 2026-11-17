/**
 * RedactThenAsk - Local Token Vault
 * Stored STRICTLY on the client device (in-memory & optional IndexedDB / offline Firestore cache).
 * NEVER transmitted over network wires or uploaded to the cloud.
 */

class TokenVault {
  constructor(sessionId = null) {
    this.sessionId = sessionId || ('vault_' + Math.random().toString(36).substring(2, 10));
    this.tokenToEntity = new Map();
    this.entityToToken = new Map();
    this.counters = {};
    this.createdAt = new Date().toISOString();
  }

  /**
   * Clear the vault completely (e.g. session reset or user wipe)
   */
  clear() {
    this.tokenToEntity.clear();
    this.entityToToken.clear();
    this.counters = {};
  }

  /**
   * Retrieves an existing token for this entity if already registered,
   * or allocates a fresh structured surrogate token.
   *
   * @param {string} originalText
   * @param {string} prefix
   * @param {string} category
   * @returns {string} token e.g. "[PATIENT_1]"
   */
  getOrCreateToken(originalText, prefix = 'ENTITY', category = 'GENERIC') {
    const normKey = originalText.toLowerCase().trim();

    if (this.entityToToken.has(normKey)) {
      const existingToken = this.entityToToken.get(normKey);
      const entry = this.tokenToEntity.get(existingToken);
      if (entry) {
        entry.occurrences++;
      }
      return existingToken;
    }

    // Allocate fresh index for this prefix
    this.counters[prefix] = (this.counters[prefix] || 0) + 1;
    const token = `[${prefix}_${this.counters[prefix]}]`;

    const entry = {
      token: token,
      original: originalText,
      category: category,
      prefix: prefix,
      occurrences: 1,
      createdAt: Date.now(),
      masked: this.generateMaskedPreview(originalText, category)
    };

    this.tokenToEntity.set(token, entry);
    this.entityToToken.set(normKey, token);

    return token;
  }

  /**
   * Masked preview for safe inspector viewing (e.g., E**** V****)
   */
  generateMaskedPreview(str, category) {
    if (!str || str.length <= 2) return '**';
    if (category === 'FINANCIAL') {
      return str.replace(/\d/g, '*');
    }
    if (category === 'ID') {
      return str.slice(0, 2) + '***' + str.slice(-2);
    }
    const words = str.split(/\s+/);
    return words.map(w => {
      if (w.length <= 2) return w[0] + '*';
      return w[0] + '*'.repeat(Math.min(w.length - 2, 4)) + w.slice(-1);
    }).join(' ');
  }

  /**
   * Lookup original value for token
   */
  lookup(token) {
    const entry = this.tokenToEntity.get(token);
    return entry ? entry.original : null;
  }

  /**
   * Returns list of tokens sorted by length descending so longer tokens
   * (e.g. [PATIENT_10]) are replaced before shorter ones ([PATIENT_1]).
   */
  getTokensForHydration() {
    return Array.from(this.tokenToEntity.keys()).sort((a, b) => b.length - a.length);
  }

  /**
   * Detailed diagnostic list of all stored tokens in this vault
   */
  inspect() {
    const list = [];
    for (const [token, entry] of this.tokenToEntity.entries()) {
      list.push({
        token: token,
        original: entry.original,
        masked: entry.masked,
        category: entry.category,
        occurrences: entry.occurrences,
        created: entry.createdAt
      });
    }
    return list;
  }

  size() {
    return this.tokenToEntity.size;
  }

  /**
   * Simulates Firestore local offline cache status
   */
  getLocalPersistenceStatus() {
    return {
      storage: 'CLIENT_LOCAL_MEMORY_VAULT',
      isolated: true,
      networkEgress: false,
      firestoreOfflineCacheSynced: true,
      itemCount: this.size(),
      sessionId: this.sessionId
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TokenVault };
}
