/**
 * RedactThenAsk - In-Page Content Script
 * Automatically injects privacy shield into ChatGPT, Claude, Gemini, etc.
 */

(function () {
  console.log('[RedactThenAsk] Content script loaded');

  let activeVault = new TokenVault();
  const policyManager = new PolicyManager();
  const redactor = new RedactorEngine(policyManager.getActivePolicy());
  const rehydrator = new RehydratorEngine();

  // Load existing vault from chrome.storage
  chrome.storage.local.get(['tokenVaultData'], (res) => {
    if (res.tokenVaultData) {
      try {
        const data = JSON.parse(res.tokenVaultData);
        for (const item of data) {
          activeVault.tokenToEntity.set(item.token, item);
          activeVault.entityToToken.set(item.original.toLowerCase(), item.token);
        }
      } catch (e) {}
    }
  });

  // Inject Floating Privacy Badge
  function injectFirewallBadge() {
    if (document.getElementById('rta-firewall-badge')) return;

    const badge = document.createElement('div');
    badge.id = 'rta-firewall-badge';
    badge.className = 'rta-floating-shield';
    badge.innerHTML = `
      <div class="rta-shield-btn" title="RedactThenAsk: Click to sanitize input prompt before sending!">
        🛡️ <span class="rta-label">Redact</span>
      </div>
    `;

    document.body.appendChild(badge);

    badge.querySelector('.rta-shield-btn').addEventListener('click', () => {
      sanitizeActiveChatInput();
    });
  }

  // Find active chat input on ChatGPT, Claude, Gemini
  function findChatInput() {
    return (
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector('textarea#prompt-textarea') ||
      document.querySelector('textarea[data-id="root"]') ||
      document.querySelector('textarea')
    );
  }

  // Sanitize the text inside the chat input box
  function sanitizeActiveChatInput() {
    const inputEl = findChatInput();
    if (!inputEl) {
      alert('[RedactThenAsk] Could not find active chat input box.');
      return;
    }

    let text = inputEl.value !== undefined ? inputEl.value : inputEl.innerText;
    if (!text || !text.trim()) {
      alert('[RedactThenAsk] Input box is empty. Paste your sensitive document first!');
      return;
    }

    const result = redactor.redact(text, activeVault);
    const sanitized = result.sanitizedText;

    if (inputEl.value !== undefined) {
      inputEl.value = sanitized;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      inputEl.innerText = sanitized;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Persist vault
    const data = JSON.stringify(activeVault.inspect());
    chrome.storage.local.set({ tokenVaultData: data });

    alert(`[RedactThenAsk] 🛡️ Sanitized ${result.detections.length} entities! Your sensitive data is locked in your local vault.`);
  }

  // Periodic injection check
  setInterval(injectFirewallBadge, 2000);
})();
