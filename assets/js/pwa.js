// Install and update UI is separate from timing and never starts/restarts a solve.
const installButton = document.getElementById('installBTime');
const installHint = document.getElementById('installHint');
const offlineStatus = document.getElementById('offlineStatus');
const updateNotice = document.getElementById('pwaUpdateNotice');
const updateButton = document.getElementById('refreshBTime');
let installPrompt = null;
let registration = null;
let requestedUpdate = false;
let reloading = false;
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const timerBusy = () => !document.getElementById('timerState')?.classList.contains('ready') || document.body.dataset.historySaving === 'true';

function showInstallOptions() {
  installButton.hidden = standalone() || (!installPrompt && !isIOS);
  installHint.hidden = standalone();
  installHint.textContent = isIOS ? 'On iPhone/iPad: Share > Add to Home Screen.'
    : installPrompt ? 'Install BTime for a standalone window and offline use.'
      : 'To install, use your browser’s install option when available.';
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  showInstallOptions();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  showInstallOptions();
});
installButton.addEventListener('click', async () => {
  if (timerBusy()) return;
  if (!installPrompt) {
    installHint.hidden = false;
    return;
  }
  const prompt = installPrompt;
  installPrompt = null;
  try { await prompt.prompt(); await prompt.userChoice; }
  catch { installHint.textContent = 'Use your browser menu to install BTime.'; }
  showInstallOptions();
});

function showWaitingUpdate() {
  updateNotice.hidden = !registration?.waiting;
  updateButton.disabled = timerBusy() || requestedUpdate;
}
const updateStateObserver = new MutationObserver(showWaitingUpdate);
updateStateObserver.observe(document.getElementById('timerState'), {
  attributes: true, attributeFilter: ['class'],
});
updateStateObserver.observe(document.body, { attributes: true, attributeFilter: ['data-history-saving'] });
updateButton.addEventListener('click', () => {
  if (timerBusy() || !registration?.waiting || requestedUpdate) return;
  requestedUpdate = true;
  updateButton.disabled = true;
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
});

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!requestedUpdate || reloading) return;
    reloading = true;
    window.location.reload();
  });
  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      showWaitingUpdate();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') showWaitingUpdate();
          if (worker.state === 'redundant' && !registration.active) {
            offlineStatus.textContent = 'Offline setup failed. Reload when online to retry.';
          }
        });
      });
      await navigator.serviceWorker.ready;
      offlineStatus.textContent = 'Offline ready. Scrambles and drawings are saved on this device.';
    } catch {
      offlineStatus.textContent = 'Offline setup unavailable. Reload when online to retry.';
    }
  });
} else {
  offlineStatus.textContent = 'Offline installation requires HTTPS or localhost and service worker support.';
}
showInstallOptions();
