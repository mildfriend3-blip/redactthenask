/**
 * RedactThenAsk - Extension Background Service Worker
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[RedactThenAsk] Background Service Worker installed');
  chrome.storage.local.set({
    selectedPolicy: 'HIPAA_CLINICAL',
    installedAt: new Date().toISOString()
  });
});
