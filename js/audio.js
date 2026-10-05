// Pure Web Audio synth: warm marimba-ish tones, a celebration chord and a
// soft final horn. No audio files, so it works offline with nothing extra to
// cache. Also the read-aloud voice for story shots.

let audioCtx = null;
let soundOn = true;

// The Sounds switch in "Change the Game"
export function setSound(on) {
  soundOn = on;
}

// C major pentatonic (C D E G A), as semitones above C.
const PENTATONIC = [0, 2, 4, 7, 9];
const BASE_FREQ = 261.63; // C4
const TOP_STEP = 20; // C8; every bigger number plays this note

// Frequency of note `step` on the pentatonic scale, starting at C4 and climbing
// through the octaves without wrapping: 0 = C4, 5 = C5, 10 = C6, 20 = C8.
function pentatonicFreq(step) {
  const octave = Math.floor(step / PENTATONIC.length);
  const semitones = octave * 12 + PENTATONIC[step % PENTATONIC.length];
  return BASE_FREQ * 2 ** (semitones / 12);
}

function getContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, delay = 0, { type = 'sine', length = 0.45, level = 0.2 } = {}) {
  if (!soundOn) return;
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + delay;
    // Soften notes above C6 so the top of the scale doesn't get shrill
    const peak = level * Math.min(1, Math.sqrt(1046.5 / freq));

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + length);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + length + 0.05);
  } catch (e) {}
}

// Plays note `step` of the ascending pentatonic scale (bigger number, higher
// note). Numbers past 20 all play the top note.
export function playChime(step = 0) {
  playTone(pentatonicFreq(Math.min(TOP_STEP, Math.max(0, Math.round(step)))));
}

export function playSuccessChord() {
  [261.63, 329.63, 392.0, 523.25].forEach((f, i) => playTone(f, i * 0.08));
}

// The end of the game: a soft two-note horn rather than a harsh buzzer
export function playBuzzer() {
  playTone(196.0, 0, { type: 'triangle', length: 0.7, level: 0.16 });
  playTone(261.63, 0.12, { type: 'triangle', length: 0.8, level: 0.14 });
}

// ---------- Read-aloud ----------
// Uses the tablet's own voice, so it works offline when the device has one.

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text) {
  if (!canSpeak()) return;
  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    speechSynthesis.speak(utterance);
  } catch (e) {}
}

export function stopSpeaking() {
  if (!canSpeak()) return;
  try {
    speechSynthesis.cancel();
  } catch (e) {}
}
