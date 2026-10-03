// Pure Web Audio synth: warm marimba-ish tones and a celebration chord.
// No audio files, so it works offline with nothing extra to cache.

let audioCtx = null;

// C major pentatonic (C D E G A), as semitones above C.
const PENTATONIC = [0, 2, 4, 7, 9];
const BASE_FREQ = 261.63; // C4

// Frequency of note `step` on the pentatonic scale, starting at C4 and climbing
// through the octaves without wrapping: 0 = C4, 5 = C5, 10 = C6, 20 = C8.
function pentatonicFreq(step) {
  const octave = Math.floor(step / PENTATONIC.length);
  const semitones = octave * 12 + PENTATONIC[step % PENTATONIC.length];
  return BASE_FREQ * 2 ** (semitones / 12);
}

function playTone(freq, delay = 0) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime + delay;
    // Soften notes above C6 so the top of the scale doesn't get shrill
    const peak = 0.2 * Math.min(1, Math.sqrt(1046.5 / freq));

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  } catch (e) {}
}

// Plays note `step` of the ascending pentatonic scale (bigger number, higher note).
export function playChime(step = 0) {
  playTone(pentatonicFreq(Math.max(0, Math.round(step))));
}

export function playSuccessChord() {
  [261.63, 329.63, 392.0, 523.25].forEach((f, i) => playTone(f, i * 0.08));
}
