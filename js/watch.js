// Kid-safe video reward viewer (same shielded frame architecture as Felix's
// app): plays either Mark Rober's CrunchLabs or Amy Poehler's Smart Girls
// inside a full-screen overlay that blocks external YouTube links, remembers
// the exact timestamp per channel, and closes back to the court when the
// countdown timer hits 0:00.

import { state, saveState } from './state.js';
import { playChime, playSuccessChord, stopSpeaking } from './audio.js';
import { escHtml } from './kit.js';

const $ = (id) => document.getElementById(id);

// Full-length 16:9 episodes from https://www.youtube.com/@CrunchLabs
export const CRUNCH_VIDEOS = [
  { id: 'mvtPrx57G64', title: 'What Stops a 400 MPH Golf Ball?' },
  { id: '4fvkgAJiBQI', title: 'I Engineered the First-Ever Human Car Wash' },
  { id: 'vr_ADr-XrR4', title: 'Can Anything Survive My Crunchinator?' },
  { id: 'iSbLf1iOcZQ', title: 'Water Experiments That Look Like Magic' },
  { id: '9QldsLTaQHo', title: 'Animals vs Engineers' },
  { id: 'QMFrtyT5a2k', title: 'Making Impossible Items Float' },
  { id: 'rSgvY33JRt4', title: 'Engineers vs GIANT Egg Drop' },
  { id: 'e4icPIRX9nc', title: 'Revealing 5 Secret Magic Tricks With Science 2.0' },
  { id: '1ekU0_GPi-g', title: 'Engineers vs Thanksgiving Dinner' },
  { id: 'f8-uvmL58nE', title: 'This Is What 400 MPH Looks Like' },
  { id: 'UssG5h_ZoCk', title: 'The Secret To Being More Creative w/ Mark Rober' },
  { id: 'c0EJY15IYc8', title: 'Build Your Own Dream Treehouse' },
  { id: '3sbYbckT1VY', title: 'Engineers vs Pumpkin Carving 2.0' },
  { id: 'J0zxk-bAnL4', title: 'Destroying Camp CrunchLabs!' },
  { id: 'oUIk1KLFXOY', title: 'Filling My Warehouse w/ 10,000+ Balloons!' },
  { id: 'xqedO-SoLeA', title: 'Testing Zero Gravity!' },
  { id: 'UvCAhz9kmP8', title: 'Air Cannon Destruction w/ The Muppets!' },
  { id: 'efovc4SiXic', title: 'Ultimate Nerf Gun Battle w/ Zach King!' },
  { id: 'Hwuw3sJAJdY', title: 'Extreme Laser Maze!' },
  { id: 'EomJuxTeRm4', title: 'Epic Fire Experiments!' },
  { id: 'nHPEHFsjJe4', title: 'Velcro Suit Mini Games!' },
  { id: 'nBfK04-QPpg', title: 'Engineers vs Almost Impossible Tasks' },
  { id: '02k8vRi5f_I', title: 'Revealing 5 Secret Magic Tricks With Science' },
  { id: '16LuvR2CARA', title: "Inside Disney's Secret Engineering Lab" },
  { id: 'YLXxXxddR2E', title: "World's Largest Nerf Crossbow!" },
  { id: 'cBlDLW5pv-s', title: 'Engineers vs Food Robots' },
  { id: 'lv6R9TexjCQ', title: 'Engineers vs Extreme Hide & Seek' },
  { id: 'gynd5ZIzBjU', title: 'Engineer vs Pro Chef - Gingerbread House Contest' },
  { id: 'ltJswDvMgY8', title: 'Mark Rober Ultimate Mini Game Battle' },
  { id: 'ekUbBot8tDA', title: '5 Easy At-Home Science Experiments w/ Mark Rober' },
  { id: 'ZViWWpA2AFk', title: 'Engineers vs Pumpkin Carving' },
  { id: 'D3s14gpmea4', title: 'Mark Rober Reacts to Kids Genius Inventions' },
  { id: '86H4NwOnASE', title: 'Fake Mark Rober Prank (FIRST Championship)' },
  { id: '8_nChhKhx0U', title: 'Camp CrunchLabs Finale!' },
  { id: 'ZE_2UXsGYOM', title: 'Giant Ping Pong Explosions!' },
  { id: 'J-nHYkgd0fM', title: 'Liquid Nitrogen Explosions!' },
  { id: 'wxSkpngdQ5U', title: 'Ultimate Slime Obstacle Course!' },
  { id: 'lsY99bDMXKA', title: 'Vacuum Cannon Explosions!' },
  { id: 'xKlUXwVEIo0', title: '4,000 Mouse Trap Chain Reaction' },
  { id: 'QLHMY7F2Zd4', title: 'Surfing on 3,500,000 Airsoft BBs' },
  { id: 'g_N5y66m6tQ', title: '60 Second Mini Game Challenge' },
  { id: 't4GJ0KzoGRI', title: 'Turning Kids Drawings Into Real Toys' },
  { id: '1j1kAuqePJo', title: 'How To Build Your Own Desktop Turret Robot!' },
  { id: 'yi29dbPnu28', title: 'Arduino 101 - Crash Course w/ Mark Rober' },
  { id: 'n4biw_1ReQ0', title: "World's Largest Toy Catapult" },
  { id: 'zlqfrcJ-BY4', title: 'Building REAL LIFE Mario Karts At CrunchLabs' },
  { id: '0CPGc0vgYfM', title: '$10,000 Tennis Ball Cannon Challenge' },
  { id: '2iwkqyzwWs4', title: 'Platinum Ticket Winner CrunchLabs Tour!' },
  { id: 'bDQSJRTeoHk', title: 'MrBeast Pranked by Mark Rober at CrunchLabs' },
  { id: 'r5KEP4KOLZQ', title: "I Made My Own Video Game - Let's Build a Rocket!" },
  { id: 'HY5A_Y6l6Sg', title: 'Build a Rocket VS Mark Rober' },
  { id: 'mdiOpFQWxvA', title: 'Greatest Surprise Ever…' },
  { id: '0KCbuMevzIQ', title: 'Mark Rober Extreme Gymnastics Challenge' },
  { id: 'idAhSEDN0Zk', title: "Invisible Laser Trap Pranks YouTube's CEO" },
  { id: '3Jc6DAxyh4M', title: 'Frisbee Challenge - CrunchLabs Cup' },
  { id: '1juBcTQYWOc', title: 'Camp CrunchLabs Mega Build!' },
  { id: 'NrOM3H6O1XA', title: 'Gummy Bear Flame Volcano!' },
  { id: 'E9xR-tslE0U', title: 'Giant Whoosh Cannon!' },
  { id: 'Ysg3KPR4Uco', title: 'Giant Smoke Rings!' },
  { id: '30Jcgooj0oY', title: 'Fire Extinguisher Hovercraft!' },
  { id: 'oM3Rm9Lr7Ho', title: 'Human Glue Trap!' },
  { id: 'HLemKJnetm8', title: 'Laser Explosions!' },
  { id: '38E6mMIYbzw', title: 'Rainbow Fireballs!' },
  { id: '8jtyWrV2NCo', title: '1,071 Explosions in 10 Seconds!' },
  { id: 'bhLaAnRQ_XU', title: 'Billiard Ball Snake!' },
  { id: 'LZxHd0_J2aQ', title: 'Ping Pong Explosions!' },
  { id: 'rpNtNOAtGbU', title: 'Lego Explosions!' },
  { id: 'gKYvnjiK2xs', title: 'Battle Royale - CrunchLabs Cup' },
  { id: 'jsYP1SLRzSI', title: 'How to Levitate Household Objects' },
  { id: 'Pdt4m13EweA', title: 'Go-Kart Race - CrunchLabs Cup' },
  { id: 'NafMsMCfErk', title: "World's Largest Coin Spinner" },
  { id: 'o7SFgrWl524', title: "World's Largest Frisbee Launcher" },
  { id: 'szDbBAcP12M', title: "World's Longest Hot Wheels Track" },
  { id: 'Nw6ry2apRAQ', title: 'This Disc Launcher Gives You Superpowers!' }
];

// Verified embeddable 16:9 episodes from https://www.youtube.com/@smartgirlsattheparty
export const SMART_GIRLS_VIDEOS = [
  { id: 'W805zZ7YkQc', title: 'Making Math Fun with Danica McKellar!' },
  { id: '9iDFKp9-YaQ', title: 'Learn About Fact Families with Danica McKellar' },
  { id: 'pwiZh8_-H48', title: 'Put on Your Math Thinking Cap with Danica McKellar!' },
  { id: 'qZqjyzP6liI', title: '#STEM10: Lisa Winter, Robot Builder' },
  { id: 'UJ9yp5wsKV4', title: '#STEM10: Meet "Physics Girl" Dianna Cowern' },
  { id: 'AQSHlrVAcuU', title: '#STEM10: Alexis Lewis, Inventor' },
  { id: '7FX9kZigpjc', title: '#STEM10: Emma Yang, App Developer' },
  { id: '0BL6BVlA6B0', title: '#STEM10: Danni Washington, Ocean Advocate & Scientist' },
  { id: 'ACmirZt0LEw', title: "#STEM10: Liv Buli, Data Journalist & Children's Author" },
  { id: 'xDz2we0vUIQ', title: 'Meet Mae Jemison: First African-American Woman in Space' },
  { id: 'ryuLOrXHmU8', title: 'NASA Astronaut Peggy Whitson!' },
  { id: '3-DpUpPvhYU', title: 'How Coding & Creativity Come Together in Game Design!' },
  { id: 'Arbk_xnXUcc', title: 'Sara Hendren: Engineering for an Inclusive World!' },
  { id: '4kRITa-AP1g', title: 'Be a Betty! Meet a Computer Programming Pioneer' },
  { id: 'E4MX0p0By0s', title: 'How Code Helps Cure Blindness! Meet Dr. Sheila Nirenberg' },
  { id: 'IDsyLubp-2U', title: 'Learn to Regrow Vegetables from Kitchen Scraps!' },
  { id: 'tYgLDvitgpA', title: 'Stop Motion Animation Challenge!' },
  { id: 'yaLOzr4wFQs', title: "Smart Girl Scientists: Amy Poehler's Operation Nice" },
  { id: 'yswDsYfHWAo', title: "Glassblowing: Amy Poehler's Operation Nice" },
  { id: 'uCcN9BDscq4', title: 'Skaters: Smart Girls w/ Amy Poehler' },
  { id: '8bpEG7QTSl0', title: 'Outdoors: Smart Girls w/ Amy Poehler' },
  { id: '3qdHZFnLIjU', title: 'Lindsey Stirling: Smart Girls w/ Amy Poehler' },
  { id: 'OJqTAVJB_x8', title: 'The Feminist: Smart Girls w/ Amy Poehler' },
  { id: 'cCM38ivvjJg', title: 'Grace Helbig: Smart Girls w/ Amy Poehler' },
  { id: 'ZcAy9y_LQ3A', title: "Smart Girls Admire Firefighters: Operation Nice" },
  { id: 'CKIYa7M-vZo', title: 'STAR Flight Rescue: Operation Nice' },
  { id: 'C3QzkXTfVNU', title: 'IRONMAN Triathlete Patricia Walsh: Operation Nice' },
  { id: 'eD_uq8Q3Sio', title: 'Future Paralympian Kayaker Kelly Allen: Operation Nice' },
  { id: '3_PuiNUwJXk', title: 'Ballet Afrique: Operation Nice' },
  { id: 'jxjHPe_zEGI', title: 'Tree Planting: Operation Nice' },
  { id: 'G4wKwOZ9_5c', title: "New Zealand: Amy Poehler's Girls of the World" },
  { id: 'H34vJBtAN24', title: "Canada: Amy Poehler's Girls of the World" },
  { id: 'K2a2JrlpH80', title: "Colombia: Amy Poehler's Girls of the World" },
  { id: 'CocooLjOC5s', title: "Netherlands: Amy Poehler's Girls of the World" },
  { id: 'PlE997NivlQ', title: "Cape Verde: Amy Poehler's Girls of the World" },
  { id: 'Hc_SGlRlY-Q', title: "Peru: Amy Poehler's Girls of the World" },
  { id: 'H2Fy6eXmURA', title: "Nepal: Amy Poehler's Girls of the World" },
  { id: '8t9EIv-21NM', title: "Sweden: Amy Poehler's Girls of the World" },
  { id: 'oLCTjeRnOgw', title: "Northern Ireland: Amy Poehler's Girls of the World" },
  { id: '3Ytek_WtLTc', title: 'Power: Ask Amy' },
  { id: 'smPWA1Wq5LU', title: 'How to Say Thank You! (Modern Manners)' },
  { id: 'l0jIFZTbnCg', title: 'Math Challenges with Danica McKellar' }
];

export const WATCH_CHANNELS = {
  crunchlabs: {
    id: 'crunchlabs',
    badge: '⚙️ CRUNCHLABS',
    label: 'CrunchLabs',
    switchLabel: '✨ Smart Girls',
    videos: CRUNCH_VIDEOS
  },
  smartgirls: {
    id: 'smartgirls',
    badge: '✨ SMART GIRLS',
    label: "Amy Poehler's Smart Girls",
    switchLabel: '⚙️ CrunchLabs',
    videos: SMART_GIRLS_VIDEOS
  }
};

export const CHANNEL_IDS = Object.keys(WATCH_CHANNELS);

export const isWatchOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

function channelInfo(channelId) {
  return WATCH_CHANNELS[channelId] || WATCH_CHANNELS.crunchlabs;
}

function channelSlot(channelId) {
  const id = CHANNEL_IDS.includes(channelId) ? channelId : 'crunchlabs';
  return state.rewards.watch[id];
}

function currentVideo(channelId) {
  const ch = channelInfo(channelId);
  const slot = channelSlot(ch.id);
  const idx = ch.videos.findIndex((v) => v.id === slot.videoId);
  if (idx !== -1) return ch.videos[idx];
  slot.videoId = ch.videos[0].id;
  slot.position = 0;
  return ch.videos[0];
}

function advanceVideo(channelId) {
  const ch = channelInfo(channelId);
  const slot = channelSlot(ch.id);
  const idx = ch.videos.findIndex((v) => v.id === slot.videoId);
  const next = ch.videos[(idx + 1) % ch.videos.length];
  slot.videoId = next.id;
  slot.position = 0;
  return next;
}

// ---------- YouTube IFrame API loader ----------

let apiPromise = null;

function ensureYouTubeApi() {
  if (typeof window === 'undefined' || !document.head) return Promise.reject(new Error('no window'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      apiPromise = null;
      reject(new Error('YouTube API timeout'));
    }, 8000);

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      prev?.();
      resolve(window.YT);
    };

    if (!document.querySelector('script[data-watch-yt]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.watchYt = '1';
      script.onerror = () => {
        clearTimeout(timeout);
        apiPromise = null;
        script.remove();
        reject(new Error('YouTube API failed'));
      };
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}

export function initWatch() {
  if (typeof document === 'undefined' || !document.head) return;
  if (state.settings.rewards && state.settings.watchRewards && isWatchOnline()) {
    setTimeout(() => {
      if (state.settings.rewards && state.settings.watchRewards && isWatchOnline()) {
        ensureYouTubeApi().catch(() => {});
      }
    }, 1800);
  }
  window.addEventListener?.('online', () => {
    if (state.settings.rewards && state.settings.watchRewards) ensureYouTubeApi().catch(() => {});
  });
  document.addEventListener?.('visibilitychange', () => {
    if (document.hidden && watchOpen()) {
      pauseWatch();
      syncPosition();
      saveState({ touch: false });
    }
  });
}

// ---------- Active break session ----------

let session = null; // { channelId, player, timerId, totalMs, remainingMs, lastTick, playing, lastSavedAt, errors, onDone }

export const watchOpen = () => {
  const el = $('watch-overlay');
  return !!el && !el.hidden;
};

function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function syncPosition() {
  if (!session?.player?.getCurrentTime) return;
  try {
    const t = session.player.getCurrentTime();
    const dur = session.player.getDuration?.() || 0;
    if (Number.isFinite(t) && t >= 0) {
      if (dur > 30 && dur - t < 5) {
        advanceVideo(session.channelId);
      } else {
        channelSlot(session.channelId).position = Math.floor(t);
      }
    }
  } catch (e) {}
}

function updateChrome() {
  if (!session) return;
  const ch = channelInfo(session.channelId);
  const video = currentVideo(session.channelId);
  const badgeEl = $('watch-badge');
  const titleEl = $('watch-title');
  const timerEl = $('watch-timer');
  const barEl = $('watch-bar-fill');
  const shieldEl = $('watch-shield');
  const toggleBtn = $('watch-toggle-btn');
  const switchBtn = $('watch-switch-btn');

  if (badgeEl) {
    badgeEl.textContent = ch.badge;
    badgeEl.className = `watch-badge ${ch.id}`;
  }
  if (titleEl) titleEl.textContent = video.title;
  if (timerEl) {
    timerEl.textContent = formatTime(session.remainingMs);
    timerEl.classList.toggle('ending', session.remainingMs <= 15_000);
  }
  if (barEl) {
    const pct = Math.max(0, Math.min(100, (session.remainingMs / session.totalMs) * 100));
    barEl.style.width = `${pct}%`;
  }
  if (shieldEl) shieldEl.classList.toggle('playing', session.playing);
  if (toggleBtn) toggleBtn.textContent = session.playing ? '⏸ Pause' : '▶ Play';
  if (switchBtn) switchBtn.textContent = `Switch to ${ch.switchLabel}`;
}

function showOfflineNotice() {
  const offlineEl = $('watch-offline');
  if (offlineEl) offlineEl.hidden = false;
}

function mountPlayer(YT, video, startPos) {
  if (!session || !watchOpen()) return;
  const playerVars = {
    autoplay: 1,
    controls: 0,
    disablekb: 1,
    fs: 0,
    iv_load_policy: 3,
    modestbranding: 1,
    playsinline: 1,
    rel: 0,
    start: Math.max(0, Math.floor(startPos || 0))
  };
  if (typeof location !== 'undefined' && location.protocol?.startsWith('http')) {
    playerVars.origin = location.origin;
  }

  session.player = new YT.Player('watch-player', {
    host: 'https://www.youtube-nocookie.com',
    videoId: video.id,
    width: '100%',
    height: '100%',
    playerVars,
    events: {
      onReady: (event) => {
        if (!session) return;
        try { event.target.playVideo(); } catch (e) {}
      },
      onStateChange: (event) => {
        if (!session) return;
        const S = YT.PlayerState;
        if (event.data === S.PLAYING) {
          session.playing = true;
          session.lastTick = performance.now();
          session.errors = 0;
          const offlineEl = $('watch-offline');
          if (offlineEl) offlineEl.hidden = true;
          updateChrome();
        } else if (event.data === S.PAUSED || event.data === S.CUED) {
          syncPosition();
          session.playing = false;
          updateChrome();
        } else if (event.data === S.BUFFERING) {
          session.playing = false;
        } else if (event.data === S.ENDED) {
          session.playing = false;
          nextWatchVideo();
        }
      },
      onError: () => {
        if (!session) return;
        session.playing = false;
        session.errors += 1;
        if (session.errors < 5 && isWatchOnline()) {
          nextWatchVideo();
        } else {
          showOfflineNotice();
        }
      }
    }
  });
}

export function openWatch(channelId, durationSeconds, { onDone = null } = {}) {
  closeWatch({ silent: true });
  const ch = channelInfo(channelId);
  state.rewards.watch.channel = ch.id;
  const slot = channelSlot(ch.id);
  const totalMs = Math.max(10_000, Math.round(durationSeconds * 1000));
  stopSpeaking();

  const video = currentVideo(ch.id);
  const overlay = $('watch-overlay');
  overlay.innerHTML = `
    <section class="card watch-card" role="dialog" aria-modal="true" aria-label="Reward video break">
      <div class="watch-top">
        <div class="watch-title-wrap">
          <span id="watch-badge" class="watch-badge ${ch.id}">${escHtml(ch.badge)}</span>
          <span id="watch-title" class="watch-title">${escHtml(video.title)}</span>
        </div>
        <div id="watch-timer" class="watch-timer">${formatTime(totalMs)}</div>
      </div>
      <div class="watch-bar-track" aria-hidden="true">
        <div id="watch-bar-fill" class="watch-bar-fill"></div>
      </div>
      <div class="watch-stage">
        <div id="watch-player"></div>
        <button id="watch-shield" class="watch-shield" data-action="watch-toggle" aria-label="Play or pause video">
          <span class="watch-play-badge" aria-hidden="true">▶</span>
        </button>
        <div id="watch-offline" class="watch-offline" hidden>
          <p>${escHtml(ch.label)} needs Wi-Fi right now.</p>
        </div>
      </div>
      <div class="watch-controls">
        <button id="watch-toggle-btn" class="watch-ctrl-btn" data-action="watch-toggle">▶ Play</button>
        <button class="watch-ctrl-btn" data-action="watch-next">Next Video ⏭</button>
        <button id="watch-switch-btn" class="watch-ctrl-btn watch-switch-btn" data-action="watch-switch">Switch to ${escHtml(ch.switchLabel)}</button>
        <button class="big-btn watch-done-btn" data-action="watch-close">Back to Court 🏀</button>
      </div>
    </section>
  `;
  overlay.hidden = false;

  session = {
    channelId: ch.id,
    player: null,
    timerId: null,
    totalMs,
    remainingMs: totalMs,
    lastTick: performance.now(),
    playing: false,
    lastSavedAt: Date.now(),
    errors: 0,
    onDone
  };
  updateChrome();

  session.timerId = setInterval(() => {
    if (!session) return;
    const now = performance.now();
    const dt = Math.min(1000, Math.max(0, now - session.lastTick));
    session.lastTick = now;

    if (session.playing && !document.hidden) {
      session.remainingMs -= dt;
      syncPosition();
      if (Date.now() - session.lastSavedAt >= 5000) {
        session.lastSavedAt = Date.now();
        saveState({ touch: false });
      }
      updateChrome();
      if (session.remainingMs <= 0) {
        closeWatch({ timerDone: true });
      }
    }
  }, 250);

  if (typeof window !== 'undefined' && window.YT?.Player) {
    mountPlayer(window.YT, video, slot.position);
  } else {
    ensureYouTubeApi()
      .then((YT) => mountPlayer(YT, video, slot.position))
      .catch(() => showOfflineNotice());
  }
}

export function toggleWatchPlay() {
  if (!session?.player) return;
  try {
    const stateCode = session.player.getPlayerState?.();
    if (stateCode === 1) {
      session.player.pauseVideo();
    } else {
      session.player.playVideo();
    }
  } catch (e) {}
}

function pauseWatch() {
  try { session?.player?.pauseVideo?.(); } catch (e) {}
}

export function nextWatchVideo() {
  if (!session) return;
  const next = advanceVideo(session.channelId);
  const offlineEl = $('watch-offline');
  if (offlineEl) offlineEl.hidden = true;
  updateChrome();
  if (session.player?.loadVideoById) {
    try {
      session.player.loadVideoById({ videoId: next.id, startSeconds: 0 });
    } catch (e) {}
  }
}

export function switchWatchChannel() {
  if (!session) return;
  syncPosition();
  const nextId = session.channelId === 'crunchlabs' ? 'smartgirls' : 'crunchlabs';
  session.channelId = nextId;
  session.errors = 0;
  state.rewards.watch.channel = nextId;
  const video = currentVideo(nextId);
  const slot = channelSlot(nextId);
  const offlineEl = $('watch-offline');
  if (offlineEl) offlineEl.hidden = true;
  updateChrome();
  if (session.player?.loadVideoById) {
    try {
      session.player.loadVideoById({ videoId: video.id, startSeconds: Math.max(0, Math.floor(slot.position || 0)) });
    } catch (e) {}
  }
}

export function closeWatch({ timerDone = false, silent = false } = {}) {
  const overlay = $('watch-overlay');
  const active = session;
  session = null;

  if (active) {
    clearInterval(active.timerId);
    if (active.player) {
      try {
        const t = active.player.getCurrentTime?.();
        const dur = active.player.getDuration?.() || 0;
        if (Number.isFinite(t) && t >= 0) {
          if (dur > 30 && dur - t < 5) advanceVideo(active.channelId);
          else channelSlot(active.channelId).position = Math.floor(t);
        }
      } catch (e) {}
      try { active.player.destroy?.(); } catch (e) {}
    }
  }

  if (overlay) {
    overlay.hidden = true;
    overlay.innerHTML = '';
  }

  if (!silent && active) {
    if (timerDone) playSuccessChord();
    else playChime(4);
    active.onDone?.();
    saveState();
  }
}
