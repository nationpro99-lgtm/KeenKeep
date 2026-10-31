/**
 * Web Audio and Speech Synthesis helper for MindCare
 * Provides soothing sound generation, clear voice assistance, and AI Overview speech player with full controls.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Simple direct speech synthesis for buttons/quick prompts
export function speakText(text: string, lang: 'en' | 'kn' | 'hi' = 'en', rate: number = 0.9): void {
  if (!('speechSynthesis' in window)) return;
  
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate; // Gentle, clear speed for elderly
  utterance.pitch = 1.05;

  const voices = window.speechSynthesis.getVoices();
  const targetLang = lang === 'hi' ? 'hi-IN' : lang === 'kn' ? 'kn-IN' : 'en-IN';
  const foundVoice = voices.find(v => v.lang.startsWith(targetLang) || v.lang.startsWith(lang));
  if (foundVoice) {
    utterance.voice = foundVoice;
  }

  window.speechSynthesis.speak(utterance);
}

// Advanced Speech Controller for Feature 2: Caregiver AI Overview Voice Playback
export interface SpeechPlayerOptions {
  lang?: 'en' | 'kn' | 'hi';
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

export class AdvancedSpeechPlayer {
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private text: string = '';
  private rate: number = 1.0;
  private lang: 'en' | 'kn' | 'hi' = 'en';
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private listeners: Set<() => void> = new Set();

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn());
  }

  speak(text: string, options: SpeechPlayerOptions = {}): void {
    if (!('speechSynthesis' in window)) return;

    this.stop();
    this.text = text;
    this.rate = options.rate ?? this.rate;
    this.lang = options.lang ?? this.lang;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.rate;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const targetLang = this.lang === 'hi' ? 'hi-IN' : this.lang === 'kn' ? 'kn-IN' : 'en-IN';
    const foundVoice = voices.find(v => v.lang.startsWith(targetLang) || v.lang.startsWith(this.lang));
    if (foundVoice) {
      utterance.voice = foundVoice;
    }

    utterance.onstart = () => {
      this.isPlaying = true;
      this.isPaused = false;
      this.notify();
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      this.isPlaying = false;
      this.isPaused = false;
      this.currentUtterance = null;
      this.notify();
      if (options.onEnd) options.onEnd();
    };

    utterance.onerror = () => {
      this.isPlaying = false;
      this.isPaused = false;
      this.currentUtterance = null;
      this.notify();
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  pause(): void {
    if ('speechSynthesis' in window && this.isPlaying && !this.isPaused) {
      window.speechSynthesis.pause();
      this.isPaused = true;
      this.notify();
    }
  }

  resume(): void {
    if ('speechSynthesis' in window && this.isPaused) {
      window.speechSynthesis.resume();
      this.isPaused = false;
      this.notify();
    }
  }

  stop(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isPlaying = false;
      this.isPaused = false;
      this.currentUtterance = null;
      this.notify();
    }
  }

  replay(): void {
    if (this.text) {
      this.speak(this.text, { rate: this.rate, lang: this.lang });
    }
  }

  setRate(newRate: number): void {
    this.rate = newRate;
    if (this.isPlaying) {
      // Re-speak with new speed
      this.replay();
    } else {
      this.notify();
    }
  }

  setVolume(newVolume: number): void {
    // Note: Web Speech API does not support volume control directly on SpeechSynthesisUtterance.
    // As a workaround, we can use an AudioContext gain node if speech were routed through it, 
    // but SpeechSynthesis is separate.
    // For now, we note this limitation.
    console.warn('Volume control is not natively supported by Web Speech API.');
  }

  setLang(newLang: 'en' | 'kn' | 'hi'): void {
    this.lang = newLang;
    if (this.isPlaying) {
      this.replay();
    } else {
      this.notify();
    }
  }

  getState() {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      rate: this.rate,
      lang: this.lang,
      hasText: !!this.text
    };
  }
}

export const speechController = new AdvancedSpeechPlayer();

// Gentle pleasant chime for task completion
export function playChime(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(783.99, now + 0.35); // G5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.15);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.9);
  } catch (e) {
    console.warn('Audio chime notice:', e);
  }
}

// SOS soft warning pulse sound
export function playSosBeep(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(880, now + 0.15);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  } catch (e) {
    console.warn('Audio notice:', e);
  }
}

// Ambient Sound Generator for Calming Music Player & Calm Corner
class AmbientSoundPlayer {
  private ctx: AudioContext | null = null;
  private nodes: (AudioNode | number)[] = [];
  private isPlaying = false;
  private currentType: string | null = null;

  start(type: 'flute' | 'rain' | 'ocean' | 'forest' | 'bells') {
    this.stop();
    this.ctx = getAudioContext();
    this.isPlaying = true;
    this.currentType = type;

    if (type === 'rain' || type === 'ocean') {
      this.playPinkNoise(type === 'ocean');
    } else if (type === 'flute') {
      this.playFluteDrone();
    } else if (type === 'bells') {
      this.playMeditationBells();
    } else {
      this.playForestNature();
    }
  }

  private playPinkNoise(isOcean: boolean) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = isOcean ? 320 : 800;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    if (isOcean) {
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.12;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.05;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      this.nodes.push(lfo);
    }

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
    this.nodes.push(noise, filter, gain);
  }

  private playFluteDrone() {
    if (!this.ctx) return;
    const rootFreq = 220;
    const harmonics = [rootFreq, rootFreq * 1.5, rootFreq * 2];
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    masterGain.connect(this.ctx.destination);
    this.nodes.push(masterGain);

    harmonics.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const vibrato = this.ctx.createOscillator();
      vibrato.frequency.value = 4.5 + idx * 0.5;
      const vibratoGain = this.ctx.createGain();
      vibratoGain.gain.value = 1.8;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start();

      osc.connect(masterGain);
      osc.start();
      this.nodes.push(osc, vibrato);
    });
  }

  private playMeditationBells() {
    if (!this.ctx) return;
    const ringBell = () => {
      if (!this.ctx || !this.isPlaying) return;
      const notes = [440, 528, 660, 880];
      const freq = notes[Math.floor(Math.random() * notes.length)];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 3.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 3.6);
    };

    ringBell();
    const interval = window.setInterval(() => {
      if (!this.isPlaying) {
        clearInterval(interval);
        return;
      }
      ringBell();
    }, 4000);
    this.nodes.push(interval);
  }

  private playForestNature() {
    if (!this.ctx) return;
    this.playPinkNoise(false);
    const chirp = () => {
      if (!this.ctx || !this.isPlaying) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(2400, now);
      osc.frequency.exponentialRampToValueAtTime(3200, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(2600, now + 0.16);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    };

    const interval = window.setInterval(() => {
      if (!this.isPlaying) {
        clearInterval(interval);
        return;
      }
      chirp();
    }, 5500);
    this.nodes.push(interval);
  }

  stop() {
    this.isPlaying = false;
    this.currentType = null;
    this.nodes.forEach(node => {
      if (typeof node === 'number') {
        clearInterval(node);
      } else {
        try {
          if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
            (node as AudioScheduledSourceNode).stop();
          }
          node.disconnect();
        } catch {
          // Ignore disconnection cleanup errors
        }
      }
    });
    this.nodes = [];
  }

  getPlayingType(): string | null {
    return this.isPlaying ? this.currentType : null;
  }
}

export const ambientPlayer = new AmbientSoundPlayer();
