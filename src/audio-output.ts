import type { APU } from './apu/apu';

const BUFFER_SIZE = 2048;

export class AudioOutput {
  private ctx: AudioContext | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private gainNode: GainNode | null = null;
  private apu: APU | null = null;
  private muted = false;

  connectAPU(apu: APU): void {
    this.apu = apu;
  }

  async init(): Promise<void> {
    try {
      this.ctx = new AudioContext({ sampleRate: 44100 });
    } catch {
      console.error('Web Audio API not available');
      return;
    }

    this.gainNode = this.ctx.createGain();
    this.gainNode.connect(this.ctx.destination);

    this.scriptNode = this.ctx.createScriptProcessor(BUFFER_SIZE, 0, 1);
    this.scriptNode.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      if (this.apu) {
        this.apu.getSamples(output);
      } else {
        output.fill(0);
      }
    };
    this.scriptNode.connect(this.gainNode);
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : 1;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  isReady(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }
}
