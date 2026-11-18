// All sound is synthesized with WebAudio: no audio files, no network.
// Effects are short oscillator/noise bursts; the music is a tiny step
// sequencer (bass, kick, hats) that loops while the game runs. Nothing
// starts until the player first presses a key or clicks, so the browser's
// autoplay rules never block it.
export function createSoundBank(muted) {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let musicStep = 0;
  let nextNoteTime = 0;
  let isMuted = muted;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = isMuted ? 0 : 0.5;
      master.connect(ctx.destination);
      const len = ctx.sampleRate * 0.5;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // A minor-key bassline that walks around A: root, root, fifth, seventh.
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  const BPM = 112;
  const STEP_SECONDS = 60 / BPM / 2;

  function scheduleMusic() {
    if (!ctx) return;
    while (nextNoteTime < ctx.currentTime + 0.25) {
      const step = musicStep % 8;
      const when = nextNoteTime - ctx.currentTime;
      if (step % 2 === 0) tone(BASS[step], STEP_SECONDS * 1.8, 'triangle', 0.16, when);
      if (step % 4 === 0) noise(0.09, 0.22, 300, when); // kick
      if (step % 2 === 1) noise(0.03, 0.05, 6000, when); // hat
      if (step === 6) tone(220, STEP_SECONDS, 'sine', 0.05, when, 330);
      nextNoteTime += STEP_SECONDS;
      musicStep += 1;
    }
  }

  return {
    unlock() {
      ensure();
    },
    setMuted(m) {
      isMuted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() {
      return isMuted;
    },
    click() {
      if (!ensure()) return;
      tone(660, 0.06, 'square', 0.08);
    },
    shot() {
      if (!ensure()) return;
      noise(0.12, 0.5, 1800);
      tone(180, 0.1, 'sawtooth', 0.2, 0, 60);
    },
    guardShot() {
      if (!ensure()) return;
      noise(0.1, 0.25, 1200);
    },
    crash(strength) {
      if (!ensure()) return;
      noise(0.25, Math.min(0.6, 0.2 + strength * 0.4), 500);
      tone(90, 0.2, 'sine', 0.25, 0, 40);
    },
    pickup() {
      if (!ensure()) return;
      tone(880, 0.09, 'sine', 0.15);
      tone(1318, 0.14, 'sine', 0.15, 0.09);
    },
    sting() {
      if (!ensure()) return;
      tone(523, 0.12, 'triangle', 0.18);
      tone(659, 0.12, 'triangle', 0.18, 0.12);
      tone(784, 0.3, 'triangle', 0.2, 0.24);
    },
    fail() {
      if (!ensure()) return;
      tone(330, 0.25, 'sawtooth', 0.15, 0, 220);
      tone(220, 0.4, 'sawtooth', 0.15, 0.22, 110);
    },
    explosion() {
      if (!ensure()) return;
      noise(0.7, 0.7, 900);
      tone(60, 0.6, 'sine', 0.4, 0, 30);
    },
    engine(on) {
      if (!ensure()) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 320;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        engineOsc.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      } else if (!on && engineOsc) {
        const osc = engineOsc;
        const gain = engineGain;
        engineOsc = null;
        engineGain = null;
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 250);
      }
    },
    setEngine(speed01, on) {
      if (!engineOsc || !ctx) return;
      const target = on ? 0.03 + speed01 * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, ctx.currentTime, 0.1);
    },
    siren(on) {
      if (on && !sirenOsc) {
        if (!ensure()) return;
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'square';
        sirenOsc.frequency.value = 700;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.035;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = false;
        sirenTimer = setInterval(() => {
          if (!sirenOsc) return;
          high = !high;
          sirenOsc.frequency.setTargetAtTime(high ? 950 : 700, ctx.currentTime, 0.05);
        }, 450);
      } else if (!on && sirenOsc) {
        clearInterval(sirenTimer);
        sirenTimer = null;
        const osc = sirenOsc;
        const gain = sirenGain;
        sirenOsc = null;
        sirenGain = null;
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
        setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 300);
      }
    },
    music(on) {
      if (on && !musicTimer) {
        if (!ensure()) return;
        nextNoteTime = ctx.currentTime + 0.1;
        musicStep = 0;
        musicTimer = setInterval(scheduleMusic, 120);
      } else if (!on && musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
