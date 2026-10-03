// Fullscreen, offline support, and picking up new versions on the tablet.
//
// sw.js serves every file network-first, so whenever the tablet is online it
// loads the newest deploy, and offline it falls back to the last copy it saw.
//
// An installed app on Android can sit open in the background for days, though.
// So when the app comes back to the foreground we compare the version this page
// was built with against version.json on the server, and reload if a newer
// version has been published since.

import { APP_VERSION } from './version.js';

const isDev = APP_VERSION.startsWith('__');
const CHECK_EVERY_MS = 60 * 1000;
let lastCheck = 0;

async function fetchLatestVersion() {
  try {
    const res = await fetch('version.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.version === 'string' ? data.version : null;
  } catch (e) {
    return null; // offline or local dev server
  }
}

async function reloadIfOutdated() {
  if (isDev) return;
  lastCheck = Date.now();
  const latest = await fetchLatestVersion();
  if (!latest || latest === APP_VERSION) return;

  // Only try once per version, so a slow CDN can't cause a reload loop
  try {
    if (sessionStorage.getItem('reloaded-for') === latest) return;
    sessionStorage.setItem('reloaded-for', latest);
  } catch (e) {
    return;
  }
  location.reload();
}

// The manifest asks for fullscreen, but a copy installed before that can keep
// running in standalone mode (status bar showing) until Chrome refreshes it.
// In that case, switch to fullscreen on the next tap. Never in a browser tab.
function goFullscreenOnTap() {
  if (!matchMedia('(display-mode: standalone)').matches) return;
  if (!document.documentElement.requestFullscreen) return;
  document.addEventListener('click', () => {
    if (document.fullscreenElement) return;
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  });
}

export function initPwa() {
  document.getElementById('app-version').textContent = isDev ? 'dev' : `v${APP_VERSION}`;
  goFullscreenOnTap();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  reloadIfOutdated();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck > CHECK_EVERY_MS) {
      reloadIfOutdated();
    }
  });
}
