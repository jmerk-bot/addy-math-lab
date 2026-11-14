// Post-game rewards: Addy can either "Bank it for Lynx" memorabilia (earning
// dollars toward 3 items from the official Minnesota Lynx online store at a
// default rate of $2.50 per 20-shot full game, i.e. 12.5¢ per unassisted make)
// or trade that game's reward for a timed kid-safe video break (CrunchLabs or
// Amy Poehler's Smart Girls, in js/watch.js).
//
// When Addy's Lynx Bank reaches the price of the item she is saving toward,
// the app moves to a special Certificate page she brings to show Dad.

import { escHtml, dayKey } from './kit.js';

export const DEFAULT_FULL_GAME_CENTS = 250; // $2.50 per 20-shot full game
export const REWARD_RATES = [200, 250, 500]; // $2.00, $2.50, $5.00 per full game
export const SECONDS_PER_SHOT = 15; // 20 shots = 5:00, 10 shots = 2:30

// Custom SVG illustrations for the 3 official Minnesota Lynx store items
const HOOP_SVG = `
  <svg viewBox="0 0 96 84" class="gear-svg" aria-hidden="true">
    <rect x="12" y="8" width="72" height="48" rx="7" fill="#0c2340" stroke="#78be20" stroke-width="3"/>
    <rect x="18" y="14" width="60" height="36" rx="4" fill="none" stroke="#236192" stroke-width="1.8"/>
    <text x="48" y="27" text-anchor="middle" fill="#a4e23c" font-size="9.5" font-weight="900" letter-spacing="1.2">LYNX</text>
    <rect x="35" y="31" width="26" height="17" fill="none" stroke="#f3f7f2" stroke-width="2"/>
    <ellipse cx="48" cy="52" rx="15" ry="4.2" fill="none" stroke="#f26b1d" stroke-width="3.2"/>
    <path d="M35 53 L39 72 M41 55 L43 72 M48 56 L48 73 M55 55 L53 72 M61 53 L57 72 M37 61 L59 61 M39 67 L57 67" stroke="#e2e8f0" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="71" cy="66" r="10.5" fill="#f26b1d" stroke="#1c0f05" stroke-width="1.5"/>
    <path d="M60.5 66h21M71 55.5v21" stroke="#1c0f05" stroke-width="1.2"/>
  </svg>`;

const HOODIE_SVG = `
  <svg viewBox="0 0 96 84" class="gear-svg" aria-hidden="true">
    <path d="M32 18 C32 9 64 9 64 18 L79 28 L88 54 L76 58 L69 39 L69 74 L27 74 L27 39 L20 58 L8 54 L17 28 Z" fill="#162b49" stroke="#78be20" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M37 18 C40 26 56 26 59 18" fill="#091526" stroke="#78be20" stroke-width="2"/>
    <path d="M43 24 L43 35 M53 24 L53 35" stroke="#a4e23c" stroke-width="1.8" stroke-linecap="round"/>
    <text x="48" y="45" text-anchor="middle" fill="#a4e23c" font-size="10.5" font-weight="900" letter-spacing="1">LYNX</text>
    <path d="M36 49 L60 49" stroke="#60a5fa" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M34 57 L62 57 L65 70 L31 70 Z" fill="#0f2038" stroke="#236192" stroke-width="1.6" stroke-linejoin="round"/>
  </svg>`;

const JERSEY_SVG = `
  <svg viewBox="0 0 96 84" class="gear-svg" aria-hidden="true">
    <path d="M31 10 L40 10 C42 18 54 18 56 10 L65 10 L75 26 L67 31 L67 74 L29 74 L29 31 L21 26 Z" fill="#1d4ed8" stroke="#a4e23c" stroke-width="2.8" stroke-linejoin="round"/>
    <path d="M31 10 L29 31 M65 10 L67 31" stroke="#78be20" stroke-width="2.2"/>
    <text x="48" y="31" text-anchor="middle" fill="#a4e23c" font-size="8.5" font-weight="900" letter-spacing="1.1">LYNX</text>
    <text x="48" y="54" text-anchor="middle" fill="#ffffff" font-size="21" font-weight="900">24</text>
    <text x="48" y="67" text-anchor="middle" fill="#bfdbfe" font-size="7.5" font-weight="800" letter-spacing="0.9">COLLIER</text>
  </svg>`;

export const LYNX_GEAR = {
  hoop: {
    id: 'hoop',
    short: 'Lynx Mini Hoop',
    name: 'Minnesota Lynx Over-the-Door Mini Hoop Set',
    brand: 'Franklin Sports · Official Lynx Store',
    priceCents: 3000,
    svg: HOOP_SVG
  },
  hoodie: {
    id: 'hoodie',
    short: 'Lynx Fleece Hoodie',
    name: 'Youth Minnesota Lynx Powerful Fleece Hoodie',
    brand: 'Outerstuff · Official Lynx Store',
    priceCents: 5000,
    svg: HOODIE_SVG
  },
  jersey: {
    id: 'jersey',
    short: 'Collier #24 Jersey',
    name: 'Youth Nike Napheesa Collier #24 Explorer Jersey',
    brand: 'Nike · Official Lynx Store',
    priceCents: 9000,
    svg: JERSEY_SVG
  }
};

export const GEAR_IDS = Object.keys(LYNX_GEAR);

export function getGear(id) {
  return LYNX_GEAR[id] || LYNX_GEAR.hoop;
}

export function formatDollars(cents) {
  const safe = Math.max(0, Math.round(Number(cents) || 0));
  return `$${(safe / 100).toFixed(2)}`;
}

// Unassisted makes: shots solved on Addy's own (1st-try swish or rebound,
// excluding Coach Cheryl's "Show me how")
export function unassistedMakes(game) {
  return Math.max(0, (game?.makes || 0) - (game?.assists || 0));
}

export function centsForShots(shots, fullGameCents = DEFAULT_FULL_GAME_CENTS) {
  const s = Math.max(0, Number(shots) || 0);
  if (s === 0) return 0;
  const rate = REWARD_RATES.includes(fullGameCents) ? fullGameCents : DEFAULT_FULL_GAME_CENTS;
  return Math.round((s * rate) / 20);
}

export function watchSecondsForShots(shots) {
  const s = Math.max(0, Number(shots) || 0);
  if (s === 0) return 0;
  return Math.max(60, s * SECONDS_PER_SHOT);
}

export function formatDuration(totalSeconds) {
  const sec = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function goalReached(rewards) {
  const item = getGear(rewards.goalId);
  return rewards.bankCents >= item.priceCents;
}

// ---------- HTML builders ----------

// Lynx Gear Bank card, shown on Pregame (and compactly referenced on Final) so
// Addy can see her balance and switch which of the 3 store items she's saving
// toward whenever she wants.
export function lynxBankHtml(rewards) {
  const goal = getGear(rewards.goalId);
  const bank = rewards.bankCents;
  const pct = Math.min(100, Math.round((bank / goal.priceCents) * 100));
  const remainingCents = Math.max(0, goal.priceCents - bank);
  const reached = bank >= goal.priceCents;
  const redeemedCounts = {};
  for (const r of rewards.redeemed || []) {
    redeemedCounts[r.id] = (redeemedCounts[r.id] || 0) + 1;
  }

  const cards = GEAR_IDS.map((id) => {
    const item = LYNX_GEAR[id];
    const active = id === goal.id;
    const readyNow = bank >= item.priceCents;
    const won = redeemedCounts[id] || 0;
    return `
      <button class="gear-option ${active ? 'active' : ''} ${readyNow ? 'ready' : ''}" data-action="pick-gear" data-value="${id}" aria-pressed="${active}">
        ${won ? `<span class="gear-won-tag">✓ Earned${won > 1 ? ` ×${won}` : ''}</span>` : readyNow ? '<span class="gear-ready-tag">🎉 Ready!</span>' : ''}
        <div class="gear-art">${item.svg}</div>
        <span class="gear-opt-name">${escHtml(item.short)}</span>
        <span class="gear-opt-price">${formatDollars(item.priceCents)}</span>
      </button>`;
  }).join('');

  const perGame = formatDollars(rewards.fullGameCents);
  const subText = reached
    ? `You hit ${formatDollars(goal.priceCents)} for the ${escHtml(goal.short)}!`
    : `${formatDollars(remainingCents)} to go · Earn up to ${perGame} per full game`;

  return `
    <div class="lynx-bank-box">
      <div class="lynx-bank-head">
        <div class="lynx-bank-title-row">
          <span class="lynx-bank-kicker">💚 ADDY'S LYNX GEAR BANK</span>
          <span class="lynx-bank-balance">${formatDollars(bank)} <span class="lynx-bank-of">/ ${formatDollars(goal.priceCents)}</span></span>
        </div>
        <p class="lynx-bank-goal-name">Saving for: <strong>${escHtml(goal.name)}</strong></p>
      </div>
      <div class="lynx-bank-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="lynx-bank-fill ${reached ? 'complete' : ''}" style="width:${pct}%"></div>
      </div>
      <p class="lynx-bank-sub">${subText}</p>
      ${reached ? `<button class="cert-ready-btn" data-action="cert-open">🏆 Open Your Lynx Certificate to Show Dad!</button>` : ''}
      <div class="gear-picker-label">Switch what you're saving toward anytime:</div>
      <div class="gear-grid" role="group" aria-label="Choose Lynx gear goal">${cards}</div>
    </div>`;
}

// Post-game reward choice card on #game-final
export function finalRewardHtml(state, { watchPickerOpen = false, online = true } = {}) {
  const { game, rewards, settings } = state;
  if (!settings.rewards) return '';

  const shots = unassistedMakes(game);
  const earnCents = centsForShots(shots, rewards.fullGameCents);
  const watchSec = watchSecondsForShots(shots);
  const goal = getGear(rewards.goalId);

  if (shots === 0) {
    return `
      <div class="reward-card muted">
        <p class="reward-sub">Solve shots without "Show me how" next game to bank Lynx dollars or earn a video break!</p>
      </div>`;
  }

  if (game.rewardChoice === 'banked') {
    const added = game.bankedCents || earnCents;
    const reached = rewards.bankCents >= goal.priceCents;
    const pct = Math.min(100, Math.round((rewards.bankCents / goal.priceCents) * 100));
    return `
      <div class="reward-card banked">
        <div class="reward-done-badge">💚 Banked +${formatDollars(added)} for Lynx!</div>
        <p class="reward-done-line">Lynx Bank: <strong>${formatDollars(rewards.bankCents)}</strong> / ${formatDollars(goal.priceCents)} toward <strong>${escHtml(goal.short)}</strong></p>
        <div class="lynx-bank-bar">
          <div class="lynx-bank-fill ${reached ? 'complete' : ''}" style="width:${pct}%"></div>
        </div>
        ${reached ? `<button class="cert-ready-btn" data-action="cert-open">🏆 Open Your Lynx Certificate to Show Dad!</button>` : ''}
      </div>`;
  }

  if (game.rewardChoice === 'watched') {
    return `
      <div class="reward-card watched">
        <div class="reward-done-badge watch">🎬 Video Break Complete!</div>
        <p class="reward-done-line">Lynx Bank stays at <strong>${formatDollars(rewards.bankCents)}</strong> toward <strong>${escHtml(goal.short)}</strong> (${formatDollars(goal.priceCents)}).</p>
      </div>`;
  }

  if (watchPickerOpen && settings.watchRewards) {
    return `
      <div class="reward-card">
        <span class="reward-kicker">🎬 PICK YOUR ${formatDuration(watchSec)} REWARD SHOW</span>
        <p class="reward-sub">${online ? 'Kid-safe viewer · picks up right where you left off:' : 'Wi-Fi is needed to watch videos right now.'}</p>
        <div class="watch-channel-grid">
          <button class="watch-channel-btn crunch" data-action="reward-watch-start" data-value="crunchlabs" ${online ? '' : 'disabled'}>
            <span class="watch-ch-icon">⚙️</span>
            <span class="watch-ch-name">CrunchLabs</span>
            <span class="watch-ch-desc">Mark Rober builds &amp; science</span>
          </button>
          <button class="watch-channel-btn smartgirls" data-action="reward-watch-start" data-value="smartgirls" ${online ? '' : 'disabled'}>
            <span class="watch-ch-icon">✨</span>
            <span class="watch-ch-name">Amy Poehler's Smart Girls</span>
            <span class="watch-ch-desc">Makers, STEM &amp; Smart Girls</span>
          </button>
        </div>
        <button class="link-btn reward-back-btn" data-action="reward-watch-back">← Wait, bank +${formatDollars(earnCents)} for Lynx instead</button>
      </div>`;
  }

  const nextBank = rewards.bankCents + earnCents;
  const hitsGoal = nextBank >= goal.priceCents;
  const miniPills = GEAR_IDS.map((id) => {
    const item = LYNX_GEAR[id];
    const active = id === goal.id;
    return `<button class="gear-mini-pill ${active ? 'active' : ''}" data-action="pick-gear" data-value="${id}">${escHtml(item.short)} (${formatDollars(item.priceCents)})</button>`;
  }).join('');

  return `
    <div class="reward-card">
      <span class="reward-kicker">🎉 POST-GAME REWARD · ${shots} ${shots === 1 ? 'SHOT' : 'SHOTS'} SOLVED!</span>
      <p class="reward-sub">Choose how to use your reward from this game:</p>
      <div class="reward-choices ${settings.watchRewards ? 'two' : 'one'}">
        <button class="reward-choice-btn bank" data-action="reward-bank">
          <span class="reward-choice-top">💚 Bank +${formatDollars(earnCents)} for Lynx</span>
          <span class="reward-choice-meta">${hitsGoal
            ? `🏆 Hits ${formatDollars(goal.priceCents)} for ${escHtml(goal.short)}!`
            : `${formatDollars(rewards.bankCents)} → ${formatDollars(nextBank)} of ${formatDollars(goal.priceCents)} (${escHtml(goal.short)})`}</span>
        </button>
        ${settings.watchRewards ? `
        <button class="reward-choice-btn watch" data-action="reward-watch-pick">
          <span class="reward-choice-top">🎬 Watch ${formatDuration(watchSec)} Video</span>
          <span class="reward-choice-meta">CrunchLabs or Amy Poehler's Smart Girls</span>
        </button>` : ''}
      </div>
      <div class="gear-mini-row" role="group" aria-label="Switch Lynx gear goal">
        <span class="gear-mini-label">Saving for:</span>
        ${miniPills}
      </div>
    </div>`;
}

// Special full-page Certificate that Addy brings to show Dad
export function certificateHtml(rewards, { confirmRedeem = false } = {}) {
  const item = getGear(rewards.goalId);
  const extraCents = Math.max(0, rewards.bankCents - item.priceCents);
  const shotsEquivalent = Math.round((item.priceCents / (rewards.fullGameCents || DEFAULT_FULL_GAME_CENTS)) * 20);
  const [y, m, d] = dayKey().split('-').map(Number);
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

  return `
    <div class="cert-frame">
      <div class="cert-inner">
        <div class="cert-header">
          <img class="cert-lynx-logo" src="img/lynx-logo.svg" alt="Minnesota Lynx logo">
          <span class="cert-kicker">★ MINNESOTA LYNX MATH LAB · OFFICIAL AWARD ★</span>
          <h2 class="cert-title">Lynx Gear Certificate</h2>
        </div>

        <p class="cert-presented">PROUDLY PRESENTED TO</p>
        <div class="cert-recipient">ADDY</div>

        <div class="cert-prize-box">
          <div class="cert-prize-art">${item.svg}</div>
          <div class="cert-prize-info">
            <span class="cert-prize-tag">EARNED FROM THE LYNX ONLINE STORE</span>
            <h3 class="cert-prize-name">${escHtml(item.name)}</h3>
            <span class="cert-prize-brand">${escHtml(item.brand)}</span>
            <span class="cert-prize-price">${formatDollars(item.priceCents)} Banked!</span>
          </div>
        </div>

        <div class="cert-stats-strip">
          <span>🏀 ${shotsEquivalent} Math Shots Earned</span>
          <span>·</span>
          <span>📅 ${escHtml(dateLabel)}</span>
        </div>

        <div class="cert-signatures">
          <div class="cert-sig">
            <span class="cert-sig-script">Coach Cheryl</span>
            <span class="cert-sig-role">Head Coach</span>
          </div>
          <div class="cert-sig">
            <span class="cert-sig-script">Napheesa "Phe" #24</span>
            <span class="cert-sig-role">Lynx Captain</span>
          </div>
          <div class="cert-sig">
            <span class="cert-sig-script">Olivia "Liv"</span>
            <span class="cert-sig-role">Point Guard</span>
          </div>
        </div>

        <div class="cert-show-dad">
          🎉 You did it, Addy! Bring the tablet and show this certificate to Dad!
        </div>

        ${confirmRedeem ? `
          <div class="confirm-bar cert-confirm" role="alertdialog">
            <p>Dad's Sign-Off: Redeem <strong>${escHtml(item.name)}</strong> (${formatDollars(item.priceCents)})? ${extraCents > 0 ? `${formatDollars(extraCents)} will stay in Addy's Lynx Bank toward her next goal.` : "Addy's Lynx Bank will reset to $0.00 for her next goal."}</p>
            <div class="confirm-actions">
              <button class="quiet-btn small" data-action="cert-redeem-cancel">Cancel</button>
              <button class="confirm-yes" data-action="cert-redeem-yes">Mark Redeemed ✓</button>
            </div>
          </div>
        ` : `
          <div class="cert-actions">
            <button class="link-btn" data-action="cert-close">← Back to Court (Keep Saving)</button>
            <button class="big-btn cert-dad-btn" data-action="cert-redeem-ask">Dad: Mark Redeemed ✓</button>
          </div>
        `}
      </div>
    </div>`;
}
