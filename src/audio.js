// Web Audio API — Professional synthesized sound design
// Every sound uses layered oscillators + noise + proper ADSR envelopes
// Each sound has a distinct character: no two should feel alike

let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// White noise generator — used for percussive attacks, air bursts, sparkle
function createNoise(duration) {
  const bufferSize = Math.ceil(audioCtx.sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  return source;
}

// ─────────────────────────────────────────────
// SELECT — Crystal ping: two harmonic sines ascending in parallel
// Character: light, bright, immediate confirmation
// ─────────────────────────────────────────────
export function playSelectSound() {
  initAudio();
  const t = audioCtx.currentTime;

  // Fundamental: quick upward glide 880 → 1320 Hz
  const osc1 = audioCtx.createOscillator();
  const g1 = audioCtx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, t);
  osc1.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
  g1.gain.setValueAtTime(0.001, t);
  g1.gain.linearRampToValueAtTime(0.13, t + 0.004);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc1.connect(g1);
  g1.connect(audioCtx.destination);
  osc1.start(t);
  osc1.stop(t + 0.18);

  // Octave shimmer — shorter, quieter, adds sparkle
  const osc2 = audioCtx.createOscillator();
  const g2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1760, t);
  osc2.frequency.exponentialRampToValueAtTime(2640, t + 0.08);
  g2.gain.setValueAtTime(0.001, t);
  g2.gain.linearRampToValueAtTime(0.045, t + 0.003);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc2.connect(g2);
  g2.connect(audioCtx.destination);
  osc2.start(t);
  osc2.stop(t + 0.1);
}

// ─────────────────────────────────────────────
// POP — Bubble burst: 4 layers, grows with combo size
// Character: physically satisfying; becomes epic for large groups
// ─────────────────────────────────────────────
export function playPopSound(count) {
  initAudio();
  const t = audioCtx.currentTime;
  const c = Math.max(3, count);

  // Layer 1 (always): Low thump — gives physical weight
  const oscLow = audioCtx.createOscillator();
  const gLow = audioCtx.createGain();
  oscLow.type = 'sine';
  oscLow.frequency.setValueAtTime(90, t);
  oscLow.frequency.exponentialRampToValueAtTime(38, t + 0.13);
  const punchVol = Math.min(0.18 + (c - 3) * 0.011, 0.36);
  gLow.gain.setValueAtTime(0.001, t);
  gLow.gain.linearRampToValueAtTime(punchVol, t + 0.003);
  gLow.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  oscLow.connect(gLow);
  gLow.connect(audioCtx.destination);
  oscLow.start(t);
  oscLow.stop(t + 0.15);

  // Layer 2 (always): Mid-pop body — pitch and volume scale with count
  const freq = Math.min(170 + c * 18, 720);
  const oscMid = audioCtx.createOscillator();
  const gMid = audioCtx.createGain();
  oscMid.type = 'triangle';
  oscMid.frequency.setValueAtTime(freq, t);
  oscMid.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.22);
  const midVol = Math.min(0.13 + (c - 3) * 0.009, 0.28);
  gMid.gain.setValueAtTime(0.001, t);
  gMid.gain.linearRampToValueAtTime(midVol, t + 0.005);
  gMid.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
  oscMid.connect(gMid);
  gMid.connect(audioCtx.destination);
  oscMid.start(t);
  oscMid.stop(t + 0.26);

  // Layer 3 (count ≥ 5): Air burst — highpass noise adds texture/air
  if (c >= 5) {
    const noise = createNoise(0.1);
    const nFilter = audioCtx.createBiquadFilter();
    nFilter.type = 'highpass';
    nFilter.frequency.setValueAtTime(1800 + c * 60, t);
    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(0.001, t);
    nGain.gain.linearRampToValueAtTime(Math.min(0.055 + (c - 5) * 0.005, 0.14), t + 0.002);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(audioCtx.destination);
    noise.start(t);
    noise.stop(t + 0.1);
  }

  // Layer 4 (count ≥ 10): High sparkle — combo reward shimmer
  if (c >= 10) {
    const oscHigh = audioCtx.createOscillator();
    const gHigh = audioCtx.createGain();
    oscHigh.type = 'sine';
    const sparkFreq = Math.min(760 + (c - 10) * 45, 1900);
    oscHigh.frequency.setValueAtTime(sparkFreq, t);
    oscHigh.frequency.exponentialRampToValueAtTime(sparkFreq * 1.6, t + 0.18);
    gHigh.gain.setValueAtTime(0.001, t);
    gHigh.gain.linearRampToValueAtTime(Math.min(0.065 + (c - 10) * 0.004, 0.15), t + 0.004);
    gHigh.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    oscHigh.connect(gHigh);
    gHigh.connect(audioCtx.destination);
    oscHigh.start(t);
    oscHigh.stop(t + 0.2);
  }
}

// ─────────────────────────────────────────────
// ERROR — Glitch buzz: two detuned sawteeth + noise click
// Character: harsh, clearly wrong, never confused with other sounds
// ─────────────────────────────────────────────
export function playErrorSound() {
  initAudio();
  const t = audioCtx.currentTime;

  // Main descending sawtooth
  const osc1 = audioCtx.createOscillator();
  const g1 = audioCtx.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(200, t);
  osc1.frequency.exponentialRampToValueAtTime(78, t + 0.26);
  g1.gain.setValueAtTime(0.001, t);
  g1.gain.linearRampToValueAtTime(0.1, t + 0.005);
  g1.gain.linearRampToValueAtTime(0.001, t + 0.26);
  osc1.connect(g1);
  g1.connect(audioCtx.destination);
  osc1.start(t);
  osc1.stop(t + 0.26);

  // Detuned twin (+7 Hz) — creates beating / dissonance
  const osc2 = audioCtx.createOscillator();
  const g2 = audioCtx.createGain();
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(207, t);
  osc2.frequency.exponentialRampToValueAtTime(83, t + 0.26);
  g2.gain.setValueAtTime(0.001, t);
  g2.gain.linearRampToValueAtTime(0.08, t + 0.005);
  g2.gain.linearRampToValueAtTime(0.001, t + 0.26);
  osc2.connect(g2);
  g2.connect(audioCtx.destination);
  osc2.start(t);
  osc2.stop(t + 0.26);

  // Noise click at onset — punchy attack transient
  const noise = createNoise(0.04);
  const nFilter = audioCtx.createBiquadFilter();
  nFilter.type = 'lowpass';
  nFilter.frequency.setValueAtTime(900, t);
  const nGain = audioCtx.createGain();
  nGain.gain.setValueAtTime(0.08, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  noise.connect(nFilter);
  nFilter.connect(nGain);
  nGain.connect(audioCtx.destination);
  noise.start(t);
  noise.stop(t + 0.04);
}

// ─────────────────────────────────────────────
// GAME OVER — Cinematic defeat: low rumble + descending minor chords
// Character: weighty, sad, dramatic — never confused with error sound
// ─────────────────────────────────────────────
export function playGameOverSound() {
  initAudio();
  const t = audioCtx.currentTime;

  // Low rumble: filtered noise fades in then slowly dies
  const rumble = createNoise(1.5);
  const rFilter = audioCtx.createBiquadFilter();
  rFilter.type = 'lowpass';
  rFilter.frequency.setValueAtTime(130, t);
  const rGain = audioCtx.createGain();
  rGain.gain.setValueAtTime(0.001, t);
  rGain.gain.linearRampToValueAtTime(0.13, t + 0.12);
  rGain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
  rumble.connect(rFilter);
  rFilter.connect(rGain);
  rGain.connect(audioCtx.destination);
  rumble.start(t);
  rumble.stop(t + 1.5);

  // Three descending minor notes, each with 3 oscillators for thickness
  // Intervals: E4+A3, B3+E3, F#3+B2 (minor feel)
  const notes = [
    { fund: 330, fifth: 220, sub: 165, delay: 0.0, dur: 0.55 },
    { fund: 247, fifth: 165, sub: 123, delay: 0.3, dur: 0.55 },
    { fund: 185, fifth: 123, sub: 92, delay: 0.62, dur: 0.9 },
  ];

  notes.forEach(({ fund, fifth, sub, delay, dur }) => {
    const nt = t + delay;

    // Fundamental (sine)
    const o1 = audioCtx.createOscillator();
    const g1 = audioCtx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(fund, nt);
    g1.gain.setValueAtTime(0.001, nt);
    g1.gain.linearRampToValueAtTime(0.17, nt + 0.02);
    g1.gain.exponentialRampToValueAtTime(0.001, nt + dur);
    o1.connect(g1);
    g1.connect(audioCtx.destination);
    o1.start(nt);
    o1.stop(nt + dur);

    // Fifth below — adds depth and melancholy
    const o2 = audioCtx.createOscillator();
    const g2 = audioCtx.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(fifth, nt);
    g2.gain.setValueAtTime(0.001, nt);
    g2.gain.linearRampToValueAtTime(0.1, nt + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, nt + dur);
    o2.connect(g2);
    g2.connect(audioCtx.destination);
    o2.start(nt);
    o2.stop(nt + dur);

    // Sub-octave triangle — warm low body
    const o3 = audioCtx.createOscillator();
    const g3 = audioCtx.createGain();
    o3.type = 'triangle';
    o3.frequency.setValueAtTime(sub, nt);
    g3.gain.setValueAtTime(0.001, nt);
    g3.gain.linearRampToValueAtTime(0.07, nt + 0.02);
    g3.gain.exponentialRampToValueAtTime(0.001, nt + dur);
    o3.connect(g3);
    g3.connect(audioCtx.destination);
    o3.start(nt);
    o3.stop(nt + dur);
  });
}

// ─────────────────────────────────────────────
// WIN — Triumphant fanfare: C major arpeggio with rich harmonics + sparkle
// Character: jubilant, musical, clearly celebratory
// ─────────────────────────────────────────────
export function playWinSound() {
  initAudio();
  const t = audioCtx.currentTime;

  // C major arpeggio: C5 → E5 → G5 → C6
  const notes = [
    { freq: 523.25, delay: 0.0, dur: 0.42 },
    { freq: 659.25, delay: 0.18, dur: 0.42 },
    { freq: 783.99, delay: 0.36, dur: 0.42 },
    { freq: 1046.5, delay: 0.54, dur: 0.65 }, // final note — longer sustain
  ];

  notes.forEach(({ freq, delay, dur }, idx) => {
    const nt = t + delay;
    const isLast = idx === notes.length - 1;
    const vol = isLast ? 0.19 : 0.14;

    // Sine fundamental
    const o1 = audioCtx.createOscillator();
    const g1 = audioCtx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(freq, nt);
    g1.gain.setValueAtTime(0.001, nt);
    g1.gain.linearRampToValueAtTime(vol, nt + 0.006);
    g1.gain.exponentialRampToValueAtTime(0.001, nt + dur);
    o1.connect(g1);
    g1.connect(audioCtx.destination);
    o1.start(nt);
    o1.stop(nt + dur);

    // Triangle slightly detuned — chorus warmth
    const o2 = audioCtx.createOscillator();
    const g2 = audioCtx.createGain();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(freq * 1.003, nt);
    g2.gain.setValueAtTime(0.001, nt);
    g2.gain.linearRampToValueAtTime(vol * 0.38, nt + 0.006);
    g2.gain.exponentialRampToValueAtTime(0.001, nt + dur * 0.7);
    o2.connect(g2);
    g2.connect(audioCtx.destination);
    o2.start(nt);
    o2.stop(nt + dur);

    // Octave above — shimmer layer
    const o3 = audioCtx.createOscillator();
    const g3 = audioCtx.createGain();
    o3.type = 'sine';
    o3.frequency.setValueAtTime(freq * 2, nt);
    g3.gain.setValueAtTime(0.001, nt);
    g3.gain.linearRampToValueAtTime(vol * 0.22, nt + 0.004);
    g3.gain.exponentialRampToValueAtTime(0.001, nt + dur * 0.45);
    o3.connect(g3);
    g3.connect(audioCtx.destination);
    o3.start(nt);
    o3.stop(nt + dur);
  });

  // Sparkle burst at the end — highpass noise crown
  const st = t + 0.64;
  const sparkle = createNoise(0.18);
  const sFilter = audioCtx.createBiquadFilter();
  sFilter.type = 'highpass';
  sFilter.frequency.setValueAtTime(5500, st);
  const sGain = audioCtx.createGain();
  sGain.gain.setValueAtTime(0.001, st);
  sGain.gain.linearRampToValueAtTime(0.065, st + 0.01);
  sGain.gain.exponentialRampToValueAtTime(0.001, st + 0.18);
  sparkle.connect(sFilter);
  sFilter.connect(sGain);
  sGain.connect(audioCtx.destination);
  sparkle.start(st);
  sparkle.stop(st + 0.18);
}

// ─────────────────────────────────────────────
// UNLOCK — Magical reveal: frequency sweep into shimmering G major arpeggio
// Character: wonder, reward — longer and more magical than win
// ─────────────────────────────────────────────
export function playUnlockSound() {
  initAudio();
  const t = audioCtx.currentTime;

  // Rising sweep — sense of something appearing
  const sweep = audioCtx.createOscillator();
  const sweepGain = audioCtx.createGain();
  sweep.type = 'sine';
  sweep.frequency.setValueAtTime(200, t);
  sweep.frequency.exponentialRampToValueAtTime(1050, t + 0.42);
  sweepGain.gain.setValueAtTime(0.001, t);
  sweepGain.gain.linearRampToValueAtTime(0.09, t + 0.05);
  sweepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
  sweep.connect(sweepGain);
  sweepGain.connect(audioCtx.destination);
  sweep.start(t);
  sweep.stop(t + 0.42);

  // G major arpeggio: G5 → B5 → D6 (bright, magical)
  const unlockNotes = [
    { freq: 783.99, delay: 0.36, dur: 0.58 },
    { freq: 987.77, delay: 0.52, dur: 0.58 },
    { freq: 1174.66, delay: 0.68, dur: 0.8 },
  ];

  unlockNotes.forEach(({ freq, delay, dur }) => {
    const nt = t + delay;

    // Two slightly detuned sines — shimmer / vibrato effect
    [0, 5].forEach((detune, i) => {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq + detune, nt);
      g.gain.setValueAtTime(0.001, nt);
      g.gain.linearRampToValueAtTime(i === 0 ? 0.13 : 0.055, nt + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, nt + dur);
      osc.connect(g);
      g.connect(audioCtx.destination);
      osc.start(nt);
      osc.stop(nt + dur);
    });

    // Octave triangle — warm harmonic body
    const oH = audioCtx.createOscillator();
    const gH = audioCtx.createGain();
    oH.type = 'triangle';
    oH.frequency.setValueAtTime(freq * 2, nt);
    gH.gain.setValueAtTime(0.001, nt);
    gH.gain.linearRampToValueAtTime(0.04, nt + 0.006);
    gH.gain.exponentialRampToValueAtTime(0.001, nt + dur * 0.5);
    oH.connect(gH);
    gH.connect(audioCtx.destination);
    oH.start(nt);
    oH.stop(nt + dur);
  });

  // Final magic sparkle
  const ft = t + 0.88;
  const sparkle = createNoise(0.22);
  const sfFilter = audioCtx.createBiquadFilter();
  sfFilter.type = 'highpass';
  sfFilter.frequency.setValueAtTime(4500, ft);
  const sfGain = audioCtx.createGain();
  sfGain.gain.setValueAtTime(0.001, ft);
  sfGain.gain.linearRampToValueAtTime(0.07, ft + 0.01);
  sfGain.gain.exponentialRampToValueAtTime(0.001, ft + 0.22);
  sparkle.connect(sfFilter);
  sfFilter.connect(sfGain);
  sfGain.connect(audioCtx.destination);
  sparkle.start(ft);
  sparkle.stop(ft + 0.22);
}

// ─────────────────────────────────────────────
// DAILY CALENDAR CLAIM — Soft pop + warm ascending notes + coin shimmer
// Character: cozy, gift-like, intimate — not epic, just a satisfying daily treat
// ─────────────────────────────────────────────
export function playDailyClaimSound() {
  initAudio();
  const t = audioCtx.currentTime;

  // Box-open pop: bandpass noise burst — like unsealing a gift
  const pop = createNoise(0.06);
  const popFilter = audioCtx.createBiquadFilter();
  popFilter.type = 'bandpass';
  popFilter.frequency.setValueAtTime(900, t);
  popFilter.Q.setValueAtTime(2.5, t);
  const popGain = audioCtx.createGain();
  popGain.gain.setValueAtTime(0.13, t);
  popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  pop.connect(popFilter);
  popFilter.connect(popGain);
  popGain.connect(audioCtx.destination);
  pop.start(t);
  pop.stop(t + 0.06);

  // Warm ascending notes: C5 → E5 (a major third — friendly and resolved)
  const melody = [
    { freq: 523.25, delay: 0.04, dur: 0.4, vol: 0.13 }, // C5
    { freq: 659.25, delay: 0.2, dur: 0.48, vol: 0.15 }, // E5
  ];

  melody.forEach(({ freq, delay, dur, vol }) => {
    const nt = t + delay;

    // Sine fundamental — warm and round
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, nt);
    g.gain.setValueAtTime(0.001, nt);
    g.gain.linearRampToValueAtTime(vol, nt + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, nt + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(nt);
    osc.stop(nt + dur);

    // Triangle layer — adds a soft bell-like quality
    const oscT = audioCtx.createOscillator();
    const gT = audioCtx.createGain();
    oscT.type = 'triangle';
    oscT.frequency.setValueAtTime(freq * 2, nt); // octave up, adds brightness
    gT.gain.setValueAtTime(0.001, nt);
    gT.gain.linearRampToValueAtTime(vol * 0.22, nt + 0.006);
    gT.gain.exponentialRampToValueAtTime(0.001, nt + dur * 0.5);
    oscT.connect(gT);
    gT.connect(audioCtx.destination);
    oscT.start(nt);
    oscT.stop(nt + dur);
  });

  // Coin shimmer tail — gentle highpass sparkle, like coins falling out
  const shimmerT = t + 0.26;
  const shimmer = createNoise(0.16);
  const shFilter = audioCtx.createBiquadFilter();
  shFilter.type = 'highpass';
  shFilter.frequency.setValueAtTime(4500, shimmerT);
  const shGain = audioCtx.createGain();
  shGain.gain.setValueAtTime(0.001, shimmerT);
  shGain.gain.linearRampToValueAtTime(0.05, shimmerT + 0.01);
  shGain.gain.exponentialRampToValueAtTime(0.001, shimmerT + 0.16);
  shimmer.connect(shFilter);
  shFilter.connect(shGain);
  shGain.connect(audioCtx.destination);
  shimmer.start(shimmerT);
  shimmer.stop(shimmerT + 0.16);
}

// ─────────────────────────────────────────────
// SHOP PURCHASE — Low thump + rapid coin-stack arpeggio
// Character: transactional weight + reward payoff — heavier than coin sound
// ─────────────────────────────────────────────
export function playPurchaseSound() {
  initAudio();
  const t = audioCtx.currentTime;

  // Low thump — the "ka" of ka-ching, you spent something real
  const thump = audioCtx.createOscillator();
  const thumpGain = audioCtx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(110, t);
  thump.frequency.exponentialRampToValueAtTime(50, t + 0.12);
  thumpGain.gain.setValueAtTime(0.001, t);
  thumpGain.gain.linearRampToValueAtTime(0.28, t + 0.004);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  thump.connect(thumpGain);
  thumpGain.connect(audioCtx.destination);
  thump.start(t);
  thump.stop(t + 0.14);

  // Coin-stack arpeggio: C5 → G5 → C6, tight and fast — coins landing in your chest
  const stack = [
    { freq: 523.25, delay: 0.06, dur: 0.28, vol: 0.11 }, // C5
    { freq: 783.99, delay: 0.13, dur: 0.28, vol: 0.12 }, // G5 (perfect fifth)
    { freq: 1046.5, delay: 0.2, dur: 0.38, vol: 0.14 }, // C6 (octave — payoff)
  ];

  stack.forEach(({ freq, delay, dur, vol }) => {
    const nt = t + delay;

    // Sine fundamental
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, nt);
    g.gain.setValueAtTime(0.001, nt);
    g.gain.linearRampToValueAtTime(vol, nt + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, nt + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(nt);
    osc.stop(nt + dur);

    // Triangle shimmer layer
    const oscT = audioCtx.createOscillator();
    const gT = audioCtx.createGain();
    oscT.type = 'triangle';
    oscT.frequency.setValueAtTime(freq * 1.004, nt); // slight detune for richness
    gT.gain.setValueAtTime(0.001, nt);
    gT.gain.linearRampToValueAtTime(vol * 0.35, nt + 0.004);
    gT.gain.exponentialRampToValueAtTime(0.001, nt + dur * 0.6);
    oscT.connect(gT);
    gT.connect(audioCtx.destination);
    oscT.start(nt);
    oscT.stop(nt + dur);
  });

  // Final sparkle: highpass noise crown on the top note
  const sparkT = t + 0.22;
  const spark = createNoise(0.14);
  const spkFilter = audioCtx.createBiquadFilter();
  spkFilter.type = 'highpass';
  spkFilter.frequency.setValueAtTime(5200, sparkT);
  const spkGain = audioCtx.createGain();
  spkGain.gain.setValueAtTime(0.001, sparkT);
  spkGain.gain.linearRampToValueAtTime(0.05, sparkT + 0.008);
  spkGain.gain.exponentialRampToValueAtTime(0.001, sparkT + 0.14);
  spark.connect(spkFilter);
  spkFilter.connect(spkGain);
  spkGain.connect(audioCtx.destination);
  spark.start(sparkT);
  spark.stop(sparkT + 0.14);
}

// ─────────────────────────────────────────────
// LEVEL UNLOCK — Gate click + whoosh + bright landing chord
// Character: mechanical → tension → payoff. Distinct from all other sounds.
// ─────────────────────────────────────────────
export function playLevelUnlockSound() {
  initAudio();
  const t = audioCtx.currentTime;

  // 1. Mechanical click — like a lock tumbling open
  const click = createNoise(0.05);
  const clickFilter = audioCtx.createBiquadFilter();
  clickFilter.type = 'bandpass';
  clickFilter.frequency.setValueAtTime(1400, t);
  clickFilter.Q.setValueAtTime(3.5, t);
  const clickGain = audioCtx.createGain();
  clickGain.gain.setValueAtTime(0.18, t);
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  click.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(audioCtx.destination);
  click.start(t);
  click.stop(t + 0.05);

  // 2. Rising whoosh — bandpass sweeps upward (sense of energy releasing)
  const whoosh = createNoise(0.38);
  const whooshFilter = audioCtx.createBiquadFilter();
  whooshFilter.type = 'bandpass';
  whooshFilter.frequency.setValueAtTime(280, t + 0.02);
  whooshFilter.frequency.exponentialRampToValueAtTime(3200, t + 0.36);
  whooshFilter.Q.setValueAtTime(1.2, t);
  const whooshGain = audioCtx.createGain();
  whooshGain.gain.setValueAtTime(0.001, t + 0.02);
  whooshGain.gain.linearRampToValueAtTime(0.1, t + 0.12);
  whooshGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  whoosh.connect(whooshFilter);
  whooshFilter.connect(whooshGain);
  whooshGain.connect(audioCtx.destination);
  whoosh.start(t + 0.02);
  whoosh.stop(t + 0.38);

  // 3. Landing chord — D5 + A5 hit simultaneously (a perfect fifth = open and hopeful)
  const chordTime = t + 0.3;
  [
    { freq: 587.33, vol: 0.16, dur: 0.6 }, // D5 — root
    { freq: 880.0, vol: 0.12, dur: 0.5 }, // A5 — perfect fifth
    { freq: 1174.66, vol: 0.06, dur: 0.3 }, // D6 — octave shimmer
  ].forEach(({ freq, vol, dur }) => {
    // Sine fundamental
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, chordTime);
    g.gain.setValueAtTime(0.001, chordTime);
    g.gain.linearRampToValueAtTime(vol, chordTime + 0.007);
    g.gain.exponentialRampToValueAtTime(0.001, chordTime + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(chordTime);
    osc.stop(chordTime + dur);

    // Triangle layer for warmth
    const oscT = audioCtx.createOscillator();
    const gT = audioCtx.createGain();
    oscT.type = 'triangle';
    oscT.frequency.setValueAtTime(freq * 1.002, chordTime);
    gT.gain.setValueAtTime(0.001, chordTime);
    gT.gain.linearRampToValueAtTime(vol * 0.3, chordTime + 0.007);
    gT.gain.exponentialRampToValueAtTime(0.001, chordTime + dur * 0.6);
    oscT.connect(gT);
    gT.connect(audioCtx.destination);
    oscT.start(chordTime);
    oscT.stop(chordTime + dur);
  });

  // 4. Sparkle burst on landing — highpass noise crown
  const sparkle = createNoise(0.14);
  const spFilter = audioCtx.createBiquadFilter();
  spFilter.type = 'highpass';
  spFilter.frequency.setValueAtTime(5000, chordTime);
  const spGain = audioCtx.createGain();
  spGain.gain.setValueAtTime(0.001, chordTime);
  spGain.gain.linearRampToValueAtTime(0.055, chordTime + 0.008);
  spGain.gain.exponentialRampToValueAtTime(0.001, chordTime + 0.14);
  sparkle.connect(spFilter);
  spFilter.connect(spGain);
  spGain.connect(audioCtx.destination);
  sparkle.start(chordTime);
  sparkle.stop(chordTime + 0.14);
}

// ─────────────────────────────────────────────
// COIN — Metallic gold bling: 3-oscillator inharmonic ring
// Character: crisp, bright, rewarding — very different from select ping
// ─────────────────────────────────────────────
export function playCoinSound() {
  initAudio();
  const t = audioCtx.currentTime;

  // Primary: B5 with quick chirp upward to C6
  const o1 = audioCtx.createOscillator();
  const g1 = audioCtx.createGain();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(987, t);
  o1.frequency.exponentialRampToValueAtTime(1047, t + 0.03);
  g1.gain.setValueAtTime(0.001, t);
  g1.gain.linearRampToValueAtTime(0.15, t + 0.003);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o1.connect(g1);
  g1.connect(audioCtx.destination);
  o1.start(t);
  o1.stop(t + 0.3);

  // Perfect fifth above (G6) — metallic character
  const o2 = audioCtx.createOscillator();
  const g2 = audioCtx.createGain();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(1568, t);
  o2.frequency.exponentialRampToValueAtTime(1661, t + 0.03);
  g2.gain.setValueAtTime(0.001, t);
  g2.gain.linearRampToValueAtTime(0.07, t + 0.003);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o2.connect(g2);
  g2.connect(audioCtx.destination);
  o2.start(t);
  o2.stop(t + 0.18);

  // High attack shimmer (G7 triangle) — the "bling" transient
  const o3 = audioCtx.createOscillator();
  const g3 = audioCtx.createGain();
  o3.type = 'triangle';
  o3.frequency.setValueAtTime(3136, t);
  g3.gain.setValueAtTime(0.001, t);
  g3.gain.linearRampToValueAtTime(0.045, t + 0.002);
  g3.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  o3.connect(g3);
  g3.connect(audioCtx.destination);
  o3.start(t);
  o3.stop(t + 0.07);
}
