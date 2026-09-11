import type { ManeuverType } from "@/lib/play";

export interface PlayAudio {
  ensureStarted(): Promise<void>;
  setMuted(muted: boolean): void;
  pump(): void;
  maneuver(type: ManeuverType): void;
  wipeout(): void;
  setMuffled(muffled: boolean): void;
  gasp(): void;
  destroy(): void;
}

export class OutsideAudio implements PlayAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private waveSource: AudioBufferSourceNode | null = null;
  private muted: boolean;
  private lastPumpAt = 0;

  constructor(muted: boolean) {
    this.muted = muted;
  }

  async ensureStarted(): Promise<void> {
    if (!this.context) this.createGraph();
    if (this.context?.state === "suspended") await this.context.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.25, this.context.currentTime, 0.03);
  }

  pump(): void {
    if (!this.context || this.context.currentTime - this.lastPumpAt < 0.18) return;
    this.lastPumpAt = this.context.currentTime;
    this.tone(100, 170, 0.12, 0.045, "sine");
  }

  maneuver(type: ManeuverType): void {
    const frequencies: Record<ManeuverType, number> = {
      "bottom-turn": 220,
      snap: 420,
      air: 680,
      barrel: 150,
    };
    this.tone(frequencies[type], frequencies[type] * 1.35, 0.2, 0.12, "triangle");
  }

  wipeout(): void {
    this.tone(78, 38, 0.55, 0.2, "sine");
    this.setMuffled(true);
  }

  setMuffled(muffled: boolean): void {
    if (!this.context || !this.filter) return;
    this.filter.frequency.setTargetAtTime(
      muffled ? 320 : 4_800,
      this.context.currentTime,
      0.08,
    );
  }

  gasp(): void {
    this.setMuffled(false);
    this.tone(190, 330, 0.28, 0.07, "sine");
  }

  destroy(): void {
    this.waveSource?.stop();
    void this.context?.close();
    this.waveSource = null;
    this.context = null;
  }

  private createGraph(): void {
    const AudioContextConstructor = window.AudioContext;
    this.context = new AudioContextConstructor();
    this.master = this.context.createGain();
    this.filter = this.context.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 4_800;
    this.master.gain.value = this.muted ? 0 : 0.25;
    this.filter.connect(this.master);
    this.master.connect(this.context.destination);

    const frameCount = this.context.sampleRate * 2;
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      samples[index] = (Math.random() * 2 - 1) * 0.08;
    }
    this.waveSource = this.context.createBufferSource();
    this.waveSource.buffer = buffer;
    this.waveSource.loop = true;
    this.waveSource.connect(this.filter);
    this.waveSource.start();
  }

  private tone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    gainValue: number,
    type: OscillatorType,
  ): void {
    if (!this.context || !this.filter) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.filter);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
