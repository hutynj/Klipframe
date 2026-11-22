// Web Audio API synthesizer + preview player for music, SFX, and voiceovers

class AudioEngine {
  private ctx: AudioContext | null = null;
  private previewStopper: (() => void) | null = null;
  private playbackTimer: number | null = null;
  private lastBeatIndex = -1;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public stopPreview(): void {
    if (this.previewStopper) {
      this.previewStopper();
      this.previewStopper = null;
    }
  }

  public previewSynth(preset: string, duration = 2.4): void {
    this.stopPreview();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.22, now);
    master.connect(ctx.destination);

    let active = true;
    const stopAll = () => {
      active = false;
      try {
        master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
      } catch {
        // ignore
      }
    };
    this.previewStopper = stopAll;

    if (preset === 'whoosh') {
      this.playNoiseSweep(ctx, master, now, 0.85, 220, 1400);
    } else if (preset === 'pop') {
      this.playTone(ctx, master, now, 420, 880, 0.14, 'sine');
    } else if (preset === 'shutter') {
      this.playNoiseSweep(ctx, master, now, 0.09, 1800, 600);
      this.playNoiseSweep(ctx, master, now + 0.09, 0.07, 1200, 350);
    } else if (preset === 'glitch') {
      this.playTone(ctx, master, now, 920, 180, 0.16, 'sawtooth');
      this.playTone(ctx, master, now + 0.12, 340, 1100, 0.16, 'square');
    } else if (preset === 'chime') {
      this.playTone(ctx, master, now, 880, 1320, 0.45, 'sine', 0.22);
      this.playTone(ctx, master, now + 0.12, 1320, 1760, 0.6, 'sine', 0.18);
    } else if (preset === 'impact') {
      this.playTone(ctx, master, now, 130, 38, 0.85, 'sine', 0.45);
      this.playNoiseSweep(ctx, master, now, 0.35, 700, 120);
    } else {
      const chords =
        preset === 'ambient'
          ? [220, 277.18, 329.63, 440]
          : preset === 'synth'
            ? [146.83, 220, 293.66, 349.23]
            : preset === 'acoustic'
              ? [261.63, 329.63, 392, 493.88]
              : preset === 'trap'
                ? [110, 130.81, 164.81, 196]
                : preset === 'vlog'
                  ? [261.63, 329.63, 392, 523.25]
                  : [196, 246.94, 293.66, 392];

      chords.forEach((freq, idx) => {
        if (!active) return;
        this.playTone(
          ctx,
          master,
          now + idx * 0.28,
          freq,
          freq,
          Math.max(0.45, duration - idx * 0.25),
          preset === 'synth' ? 'sawtooth' : 'triangle',
          0.08,
        );
      });
    }

    window.setTimeout(() => {
      if (this.previewStopper === stopAll) {
        stopAll();
        this.previewStopper = null;
      }
    }, duration * 1000);
  }

  public previewVoiceEffect(effect: string, duration = 1.4): void {
    this.stopPreview();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.22, now);
    master.connect(ctx.destination);

    const baseFreq =
      effect === 'deep'
        ? 110
        : effect === 'chipmunk'
          ? 490
          : effect === 'robot'
            ? 196
            : effect === 'megaphone'
              ? 330
              : 240;

    const oscType: OscillatorType =
      effect === 'robot'
        ? 'square'
        : effect === 'megaphone'
          ? 'sawtooth'
          : 'triangle';

    this.playTone(ctx, master, now, baseFreq, baseFreq * 1.18, 0.35, oscType, 0.25);
    if (effect === 'echo') {
      this.playTone(ctx, master, now + 0.22, baseFreq * 1.1, baseFreq, 0.35, 'sine', 0.14);
      this.playTone(ctx, master, now + 0.44, baseFreq, baseFreq * 0.9, 0.35, 'sine', 0.08);
    } else {
      this.playTone(ctx, master, now + 0.2, baseFreq * 1.25, baseFreq * 0.95, 0.45, oscType, 0.2);
    }

    window.setTimeout(() => {
      try {
        master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
      } catch {
        // ignore
      }
    }, duration * 1000);
  }

  public tickPlayback(
    time: number,
    isPlaying: boolean,
    activeAudioClips: Array<{
      id: string;
      startTime: number;
      duration: number;
      volume: number;
      muted: boolean;
      synthPreset?: string;
      voiceEffect?: string;
      normalize?: boolean;
    }>,
    trackMuted: boolean,
  ): void {
    if (!isPlaying || trackMuted || activeAudioClips.length === 0) {
      this.lastBeatIndex = -1;
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    const stepIndex = Math.floor(time * 2); // 120bpm eighth-ish pulse
    if (stepIndex === this.lastBeatIndex) return;
    this.lastBeatIndex = stepIndex;

    for (const clip of activeAudioClips) {
      if (clip.muted || clip.volume <= 0) continue;
      const effectiveVol = clip.normalize ? Math.max(clip.volume, 110) : clip.volume;
      const gainLevel = Math.min(0.18, (effectiveVol / 100) * 0.08);
      const preset = clip.synthPreset || 'lofi';

      if (
        preset === 'whoosh' ||
        preset === 'pop' ||
        preset === 'shutter' ||
        preset === 'glitch' ||
        preset === 'chime' ||
        preset === 'impact'
      ) {
        if (Math.abs(time - clip.startTime) < 0.55) {
          this.previewSynth(preset, 0.6);
        }
        continue;
      }

      const scale =
        preset === 'ambient'
          ? [220, 261.63, 329.63, 392]
          : preset === 'synth'
            ? [146.83, 174.61, 220, 261.63]
            : preset === 'vlog'
              ? [261.63, 329.63, 392, 440]
              : [196, 246.94, 293.66, 329.63];

      const pitchMul =
        clip.voiceEffect === 'deep'
          ? 0.72
          : clip.voiceEffect === 'chipmunk'
            ? 1.55
            : clip.voiceEffect === 'robot'
              ? 0.92
              : clip.voiceEffect === 'megaphone'
                ? 1.15
                : 1;

      const freq = scale[stepIndex % scale.length] * pitchMul;
      const oscType: OscillatorType =
        clip.voiceEffect === 'robot'
          ? 'square'
          : preset === 'synth' || clip.voiceEffect === 'megaphone'
            ? 'sawtooth'
            : 'triangle';

      const master = ctx.createGain();
      master.gain.setValueAtTime(gainLevel, ctx.currentTime);
      master.connect(ctx.destination);
      this.playTone(ctx, master, ctx.currentTime, freq, freq, 0.42, oscType, 0.35);
      if (clip.voiceEffect === 'echo') {
        this.playTone(ctx, master, ctx.currentTime + 0.18, freq, freq, 0.32, 'sine', 0.18);
      }
    }
  }

  public stopPlayback(): void {
    this.lastBeatIndex = -1;
    if (this.playbackTimer !== null) {
      window.clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  public speakText(text: string, rate = 1, pitch = 1): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.previewSynth('vlog', 1.2);
      return false;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text || 'KlipFrame Studio');
      utterance.rate = rate;
      utterance.pitch = pitch;
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      this.previewSynth('vlog', 1.2);
      return false;
    }
  }

  private playTone(
    ctx: AudioContext,
    dest: AudioNode,
    startAt: number,
    freqStart: number,
    freqEnd: number,
    dur: number,
    type: OscillatorType,
    peak = 0.25,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, startAt);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), startAt + dur);
    }

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(peak, startAt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(startAt);
    osc.stop(startAt + dur + 0.02);
  }

  private playNoiseSweep(
    ctx: AudioContext,
    dest: AudioNode,
    startAt: number,
    dur: number,
    freqStart: number,
    freqEnd: number,
  ): void {
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freqStart, startAt);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, freqEnd), startAt + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, startAt);
    gain.gain.linearRampToValueAtTime(0.35, startAt + dur * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(startAt);
    noise.stop(startAt + dur + 0.02);
  }
}

export const audioEngine = new AudioEngine();
