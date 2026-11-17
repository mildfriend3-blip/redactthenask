/**
 * RedactThenAsk - Main Client Application Orchestrator
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Core Engines
  const vault = new TokenVault();
  const policyManager = new PolicyManager();
  const redactor = new RedactorEngine(policyManager.getActivePolicy());
  const rehydrator = new RehydratorEngine();
  const appCheck = new AppCheckClient();
  const devtoolsInspector = new DevToolsInspector('devtools-container');

  // DOM Elements
  const docInput = document.getElementById('document-input');
  const promptInput = document.getElementById('prompt-input');
  const policySelect = document.getElementById('policy-select');
  const btnRunFirewall = document.getElementById('btn-run-firewall');
  const piiCounterBadge = document.getElementById('pii-counter-badge');
  const hydratedOutput = document.getElementById('hydrated-output');
  const toggleHighlights = document.getElementById('toggle-highlights');
  const aiModelTag = document.getElementById('ai-model-tag');
  const vaultTableBody = document.getElementById('vault-table-body');
  const vaultCountTab = document.getElementById('vault-count-tab');
  const diffOriginal = document.getElementById('diff-original');
  const diffSanitized = document.getElementById('diff-sanitized');
  const remoteConfigVersion = document.getElementById('remoteconfig-version');
  const settingsModal = document.getElementById('settings-modal');
  const btnSettings = document.getElementById('btn-settings');
  const modalClose = document.getElementById('modal-close');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const inputApiKey = document.getElementById('input-api-key');
  const btnExtensionInfo = document.getElementById('btn-extension-info');

  // Load saved API key from localStorage if present
  if (localStorage.getItem('redact_gemini_api_key')) {
    inputApiKey.value = localStorage.getItem('redact_gemini_api_key');
  }

  // Sync Remote Config dynamically
  const rcSync = await policyManager.syncFromRemoteConfig();
  if (rcSync && rcSync.version) {
    remoteConfigVersion.textContent = `v${rcSync.version}`;
  }

  let latestExecutionResult = null;

  // Preset Selection Handler
  function loadPreset(presetKey) {
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.querySelector(`.preset-btn[data-preset="${presetKey}"]`);
    if (targetBtn) targetBtn.classList.add('active');

    if (presetKey === 'clear') {
      docInput.value = '';
      promptInput.value = '';
      updatePiiCounter();
      return;
    }

    const preset = PRESET_DOCUMENTS[presetKey];
    if (preset) {
      docInput.value = preset.content;
      promptInput.value = preset.defaultPrompt;
      policySelect.value = preset.policyId;
      policyManager.setPolicy(preset.policyId);
      redactor.setPolicy(policyManager.getActivePolicy());
      updatePiiCounter();
    }
  }

  // Quick live entity counter
  function updatePiiCounter() {
    const text = docInput.value;
    if (!text.trim()) {
      piiCounterBadge.textContent = '0 Entities Detected';
      piiCounterBadge.style.color = 'var(--text-muted)';
      return;
    }

    const dryVault = new TokenVault();
    const result = redactor.redact(text, dryVault);
    const count = dryVault.size();

    piiCounterBadge.textContent = `🛡️ ${count} Sensitive Entities Detected`;
    piiCounterBadge.style.color = count > 0 ? '#fbbf24' : '#10b981';
  }

  docInput.addEventListener('input', updatePiiCounter);

  policySelect.addEventListener('change', () => {
    policyManager.setPolicy(policySelect.value);
    redactor.setPolicy(policyManager.getActivePolicy());
    updatePiiCounter();
  });

  // Attach Preset Buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const presetKey = e.currentTarget.getAttribute('data-preset');
      loadPreset(presetKey);
    });
  });

  // Initial load: Medical preset
  loadPreset('medical');

  // Render Vault Table
  function renderVaultTable() {
    const items = vault.inspect();
    vaultCountTab.textContent = items.length;

    if (items.length === 0) {
      vaultTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
            No tokens stored. Run the firewall to populate the local vault.
          </td>
        </tr>
      `;
      return;
    }

    vaultTableBody.innerHTML = items.map(item => `
      <tr>
        <td><strong style="color: #22d3ee;">${item.token}</strong></td>
        <td><span class="hydrated-chip chip-${(item.category || 'generic').toLowerCase()}">${item.category}</span></td>
        <td>
          <span class="masked-value" title="Click to reveal / hide secret" data-original="${item.original}" data-masked="${item.masked}">
            ${item.masked}
          </span>
        </td>
        <td>${item.occurrences}</td>
      </tr>
    `).join('');

    // Click to toggle reveal masked secret
    vaultTableBody.querySelectorAll('.masked-value').forEach(span => {
      span.addEventListener('click', (e) => {
        const el = e.currentTarget;
        const orig = el.getAttribute('data-original');
        const mask = el.getAttribute('data-masked');
        if (el.textContent.trim() === mask) {
          el.textContent = orig;
          el.style.color = '#34d399';
        } else {
          el.textContent = mask;
          el.style.color = '#fbbf24';
        }
      });
    });
  }

  // Tab switching for output panel
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      e.currentTarget.classList.add('active');
      const targetId = e.currentTarget.getAttribute('data-tab');
      const pane = document.getElementById(`tab-${targetId}`);
      if (pane) pane.classList.add('active');
    });
  });

  // Visual helper: Pipeline animation steps
  function highlightStage(stageNum) {
    document.querySelectorAll('.pipeline-node').forEach(node => node.classList.remove('active-stage'));
    if (stageNum >= 1 && stageNum <= 4) {
      const node = document.getElementById(`stage-${stageNum}`);
      if (node) node.classList.add('active-stage');
    }
  }

  // --- CORE EXECUTION PIPELINE ---
  btnRunFirewall.addEventListener('click', async () => {
    const rawDoc = docInput.value;
    const prompt = promptInput.value || 'Summarize key findings and recommendations.';

    if (!rawDoc.trim()) {
      alert('Please paste or select a document to analyze.');
      return;
    }

    btnRunFirewall.disabled = true;
    btnRunFirewall.innerHTML = '<span>⏳</span> Redacting On-Device...';

    const executionStartTime = Date.now();

    try {
      // --- STAGE 1: ON-DEVICE REDACTION PASS ---
      highlightStage(1);
      vault.clear();
      const activePolicy = policyManager.getActivePolicy();
      redactor.setPolicy(activePolicy);

      const redactResult = redactor.redact(rawDoc, vault);
      const sanitizedDoc = redactResult.sanitizedText;

      // Update Diff views
      diffOriginal.textContent = rawDoc;
      diffSanitized.innerHTML = sanitizedDoc.replace(/(\[[A-Z0-9_]+_\d+\])/g, '<span class="token-highlight">$1</span>');

      // --- STAGE 2: LOCAL TOKEN VAULT LOCK ---
      highlightStage(2);
      renderVaultTable();
      await new Promise(r => setTimeout(r, 120)); // Brief visual pause

      // --- STAGE 3: CLOUD TRANSIT PASS (SANITIZED ONLY) ---
      highlightStage(3);
      btnRunFirewall.innerHTML = '<span>⚡</span> Transmitting Safe Payload...';

      const headers = await appCheck.getHeaders();
      const requestPayload = {
        prompt: prompt,
        sanitizedDocument: sanitizedDoc,
        policyId: activePolicy.id,
        apiKey: localStorage.getItem('redact_gemini_api_key') || undefined
      };

      const requestStartTime = Date.now();
      const response = await fetch('/api/reason', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestPayload)
      });

      const responseJson = await response.json();
      const requestDuration = Date.now() - requestStartTime;

      if (!response.ok) {
        throw new Error(responseJson.error || 'Cloud reasoning request failed');
      }

      // Record in DevTools Inspector
      devtoolsInspector.recordTransaction({
        url: 'POST /api/reason',
        headers: headers,
        requestBody: requestPayload,
        responseBody: responseJson,
        durationMs: requestDuration,
        policyVersion: activePolicy.version,
        vault: vault
      });

      // --- STAGE 4: ON-DEVICE RE-HYDRATION PASS ---
      highlightStage(4);
      btnRunFirewall.innerHTML = '<span>🔄</span> Re-hydrating Locally...';

      const cloudAnswer = responseJson.cloudResponse || '';
      const rehydration = rehydrator.rehydrate(cloudAnswer, vault, true);

      latestExecutionResult = {
        cloudAnswer: cloudAnswer,
        rehydration: rehydration,
        model: responseJson.model || 'Gemini 2.5 Flash'
      };

      // Render Final Answer
      renderHydratedAnswer();

      aiModelTag.textContent = `Model: ${responseJson.model} (${requestDuration}ms)`;

    } catch (err) {
      console.error('[Firewall Error]', err);
      alert('Firewall Pipeline Error: ' + err.message);
      hydratedOutput.innerHTML = `<p style="color: #ef4444;">Error during reasoning: ${err.message}</p>`;
    } finally {
      btnRunFirewall.disabled = false;
      btnRunFirewall.innerHTML = '<span>🛡️</span> Run Privacy Firewall &amp; Ask AI';
      setTimeout(() => highlightStage(0), 1000);
    }
  });

  // Render Hydrated Output respecting highlight toggle
  function renderHydratedAnswer() {
    if (!latestExecutionResult) return;

    const showHighlights = toggleHighlights.checked;
    const text = showHighlights
      ? latestExecutionResult.rehydration.hydratedHtml
      : escapeHtml(latestExecutionResult.rehydration.hydratedText);

    // Format markdown-like elements into HTML paragraphs
    hydratedOutput.innerHTML = formatMarkdown(text);
  }

  toggleHighlights.addEventListener('change', renderHydratedAnswer);

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatMarkdown(text) {
    if (!text) return '';
    return text
      .split('\n\n')
      .map(paragraph => {
        paragraph = paragraph.trim();
        if (paragraph.startsWith('### ')) {
          return `<h3>${paragraph.substring(4)}</h3>`;
        }
        if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
          return `<p><strong>${paragraph.slice(2, -2)}</strong></p>`;
        }
        if (paragraph.startsWith('- ') || paragraph.startsWith('1. ')) {
          const lines = paragraph.split('\n').map(l => `<li>${l.replace(/^[-*]|\d+\.\s*/, '')}</li>`).join('');
          return `<ul>${lines}</ul>`;
        }
        return `<p>${paragraph.replace(/\n/g, '<br>')}</p>`;
      })
      .join('');
  }

  // Settings Modal Handlers
  btnSettings.addEventListener('click', () => {
    settingsModal.classList.add('active');
  });

  modalClose.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  btnSaveSettings.addEventListener('click', () => {
    const val = inputApiKey.value.trim();
    if (val) {
      localStorage.setItem('redact_gemini_api_key', val);
    } else {
      localStorage.removeItem('redact_gemini_api_key');
    }
    settingsModal.classList.remove('active');
  });

  // Chrome Extension Info
  btnExtensionInfo.addEventListener('click', () => {
    alert(
      "🧩 RedactThenAsk Chrome Extension\n\n" +
      "To load the Chrome Extension:\n" +
      "1. Open Chrome and navigate to chrome://extensions\n" +
      "2. Enable 'Developer mode' in the top-right corner\n" +
      "3. Click 'Load unpacked'\n" +
      "4. Select the 'extension/' folder inside this project!\n\n" +
      "Once loaded, you can paste sensitive text into ChatGPT, Claude, or Gemini and click the Redact shield to keep your data safe!"
    );
  });
});
