/**
 * RedactThenAsk - Chrome Extension Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const vaultCountEl = document.getElementById('vault-count');
  const policySelect = document.getElementById('policy-select');
  const btnRedact = document.getElementById('btn-redact-clipboard');
  const btnRehydrate = document.getElementById('btn-rehydrate-clipboard');
  const btnClear = document.getElementById('btn-clear-vault');
  const previewText = document.getElementById('preview-text');

  // Load state from chrome.storage.local
  async function loadVault() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['tokenVaultData', 'selectedPolicy'], (res) => {
        const v = new TokenVault();
        if (res.tokenVaultData) {
          try {
            const data = JSON.parse(res.tokenVaultData);
            for (const item of data) {
              v.tokenToEntity.set(item.token, item);
              v.entityToToken.set(item.original.toLowerCase(), item.token);
            }
          } catch (e) {}
        }
        if (res.selectedPolicy) {
          policySelect.value = res.selectedPolicy;
        }
        vaultCountEl.textContent = v.size();
        resolve(v);
      });
    });
  }

  async function saveVault(v) {
    const data = JSON.stringify(v.inspect());
    return new Promise((resolve) => {
      chrome.storage.local.set({ tokenVaultData: data, selectedPolicy: policySelect.value }, () => {
        vaultCountEl.textContent = v.size();
        resolve();
      });
    });
  }

  let vault = await loadVault();

  policySelect.addEventListener('change', () => {
    chrome.storage.local.set({ selectedPolicy: policySelect.value });
  });

  // Action 1: Redact Clipboard
  btnRedact.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        previewText.textContent = 'Clipboard is empty!';
        return;
      }

      const policyManager = new PolicyManager();
      policyManager.setPolicy(policySelect.value);
      const redactor = new RedactorEngine(policyManager.getActivePolicy());

      const result = redactor.redact(text, vault);
      await saveVault(vault);

      await navigator.clipboard.writeText(result.sanitizedText);

      previewText.innerHTML = `<strong>Redacted ${result.detections.length} entities!</strong><br>Safe sanitized text copied to clipboard. Paste safely into ChatGPT/Claude!`;
      previewText.style.color = '#3fb950';
    } catch (err) {
      previewText.textContent = 'Clipboard Error: ' + err.message;
      previewText.style.color = '#f85149';
    }
  });

  // Action 2: Re-hydrate Clipboard
  btnRehydrate.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        previewText.textContent = 'Clipboard is empty!';
        return;
      }

      const rehydrator = new RehydratorEngine();
      const result = rehydrator.rehydrate(text, vault, false);

      await navigator.clipboard.writeText(result.hydratedText);

      previewText.innerHTML = `<strong>Re-hydrated ${result.substitutionsCount} tokens!</strong><br>Natural response restored & copied to clipboard.`;
      previewText.style.color = '#58a6ff';
    } catch (err) {
      previewText.textContent = 'Clipboard Error: ' + err.message;
      previewText.style.color = '#f85149';
    }
  });

  // Action 3: Clear Vault
  btnClear.addEventListener('click', async () => {
    vault = new TokenVault();
    await saveVault(vault);
    previewText.textContent = 'Local Token Vault cleared.';
    previewText.style.color = '#8b949e';
  });
});
