/**
 * RedactThenAsk - On-Device Re-hydration Pass
 * Swaps surrogate tokens in the cloud reasoning response back into the original entities locally.
 * Nothing identifiable ever left the device, yet the user reads a complete natural answer.
 */

class RehydratorEngine {
  constructor() {}

  /**
   * Rehydrates a sanitized text string using the local vault.
   *
   * @param {string} textWithTokens - Cloud AI response containing [TOKEN_#] placeholders
   * @param {TokenVault} vault - Local Token Vault containing the mappings
   * @param {boolean} highlight - Whether to wrap substituted entities in HTML tags for UI display
   * @returns {Object} { hydratedText, hydratedHtml, substitutionsCount, matchedTokens, unmappedTokens }
   */
  rehydrate(textWithTokens, vault, highlight = false) {
    if (!textWithTokens || !vault) {
      return {
        hydratedText: textWithTokens || '',
        hydratedHtml: textWithTokens || '',
        substitutionsCount: 0,
        matchedTokens: [],
        unmappedTokens: []
      };
    }

    const matchedTokens = new Set();
    const unmappedTokens = new Set();
    let substitutionsCount = 0;

    // Tokens sorted longest-first to prevent partial collisions
    const tokens = vault.getTokensForHydration();

    // 1. Plain text hydration
    let plainText = textWithTokens;
    for (const token of tokens) {
      const original = vault.lookup(token);
      if (!original) continue;

      // Escape brackets for regex
      const escapedToken = token.replace(/[\[\]]/g, '\\$&');
      const regex = new RegExp(escapedToken, 'g');

      plainText = plainText.replace(regex, () => {
        substitutionsCount++;
        matchedTokens.add(token);
        return original;
      });
    }

    // 2. Rich HTML hydration (with interactive badges)
    let htmlText = this.escapeHtml(textWithTokens);

    for (const token of tokens) {
      const original = vault.lookup(token);
      const entry = vault.tokenToEntity.get(token);
      if (!original || !entry) continue;

      const escapedToken = token.replace(/[\[\]]/g, '\\$&');
      const regex = new RegExp(escapedToken, 'g');

      const categoryClass = (entry.category || 'generic').toLowerCase();
      const badge = `<span class="hydrated-chip chip-${categoryClass}" title="Re-hydrated from ${token} (Local Vault)" data-token="${token}">${this.escapeHtml(original)}</span>`;

      htmlText = htmlText.replace(regex, badge);
    }

    // Check for any unmapped residual tokens like [SOMETHING_#]
    const residualRegex = /\[[A-Z0-9_]+_\d+\]/g;
    let residualMatch;
    while ((residualMatch = residualRegex.exec(plainText)) !== null) {
      if (!matchedTokens.has(residualMatch[0])) {
        unmappedTokens.add(residualMatch[0]);
      }
    }

    return {
      hydratedText: plainText,
      hydratedHtml: htmlText,
      substitutionsCount: substitutionsCount,
      matchedTokens: Array.from(matchedTokens),
      unmappedTokens: Array.from(unmappedTokens)
    };
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RehydratorEngine };
}
