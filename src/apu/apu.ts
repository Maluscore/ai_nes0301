import { PulseChannel } from './pulse-channel';
import { TriangleChannel } from './triangle-channel';
import { NoiseChannel } from './noise-channel';
import { FrameCounter, FrameEvent } from './frame-counter';

const CPU_CLOCK_HZ = 1789773;
const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 4096;

export class APU {
  readonly pulse1 = new PulseChannel(0);
  readonly pulse2 = new PulseChannel(1);
  readonly triangle = new TriangleChannel();
  readonly noise = new NoiseChannel();

  private readonly frameCounter = new FrameCounter();
  private oddCycle = false;

  // Sample output
  private readonly sampleBuffer = new Float32Array(BUFFER_SIZE);
  private writePos = 0;
  private readPos = 0;
  private sampleAccumulator = 0;
  private readonly cyclesPerSample = CPU_CLOCK_HZ / SAMPLE_RATE;

  // High-pass filters (match NES hardware)
  private prevSampleIn = 0;
  private prevFilterOut1 = 0;
  private prevFilterOut2 = 0;

  reset(): void {
    this.writePos = 0;
    this.readPos = 0;
    this.sampleAccumulator = 0;
    this.oddCycle = false;
    this.prevSampleIn = 0;
    this.prevFilterOut1 = 0;
    this.prevFilterOut2 = 0;
  }

  writeRegister(addr: number, value: number): void {
    switch (addr) {
      case 0x4000: case 0x4001: case 0x4002: case 0x4003:
        this.pulse1.writeRegister(addr & 3, value);
        break;
      case 0x4004: case 0x4005: case 0x4006: case 0x4007:
        this.pulse2.writeRegister(addr & 3, value);
        break;
      case 0x4008: case 0x4009: case 0x400A: case 0x400B:
        this.triangle.writeRegister(addr & 3, value);
        break;
      case 0x400C: case 0x400D: case 0x400E: case 0x400F:
        this.noise.writeRegister(addr & 3, value);
        break;
      case 0x4015:
        this.pulse1.lengthCounter.setEnabled((value & 1) !== 0);
        this.pulse2.lengthCounter.setEnabled((value & 2) !== 0);
        this.triangle.lengthCounter.setEnabled((value & 4) !== 0);
        this.noise.lengthCounter.setEnabled((value & 8) !== 0);
        break;
      case 0x4017: {
        const event = this.frameCounter.writeRegister(value);
        if (event !== FrameEvent.NONE) {
          this.clockFrameEvent(event);
        }
        break;
      }
    }
  }

  readRegister(addr: number): number {
    if (addr === 0x4015) {
      let status = 0;
      if (this.pulse1.lengthCounter.isActive()) status |= 1;
      if (this.pulse2.lengthCounter.isActive()) status |= 2;
      if (this.triangle.lengthCounter.isActive()) status |= 4;
      if (this.noise.lengthCounter.isActive()) status |= 8;
      return status;
    }
    return 0;
  }

  tick(cpuCycles: number): void {
    for (let i = 0; i < cpuCycles; i++) {
      // Frame counter
      const event = this.frameCounter.tick();
      if (event !== FrameEvent.NONE) {
        this.clockFrameEvent(event);
      }

      // Triangle ticks every CPU cycle
      this.triangle.tickTimer();

      // Pulse and noise tick every other CPU cycle
      this.oddCycle = !this.oddCycle;
      if (this.oddCycle) {
        this.pulse1.tickTimer();
        this.pulse2.tickTimer();
        this.noise.tickTimer();
      }

      // Sample generation
      this.sampleAccumulator++;
      if (this.sampleAccumulator >= this.cyclesPerSample) {
        this.sampleAccumulator -= this.cyclesPerSample;
        this.pushSample();
      }
    }
  }

  getSamples(out: Float32Array): number {
    let count = 0;
    for (let i = 0; i < out.length; i++) {
      if (this.readPos !== this.writePos) {
        out[i] = this.sampleBuffer[this.readPos];
        this.readPos = (this.readPos + 1) & (BUFFER_SIZE - 1);
        count++;
      } else {
        out[i] = 0;
      }
    }
    return count;
  }

  availableSamples(): number {
    return (this.writePos - this.readPos + BUFFER_SIZE) & (BUFFER_SIZE - 1);
  }

  private clockFrameEvent(event: FrameEvent): void {
    // Quarter frame: envelope + linear counter
    this.pulse1.tickEnvelope();
    this.pulse2.tickEnvelope();
    this.triangle.tickLinearCounter();
    this.noise.tickEnvelope();

    // Half frame: length counter + sweep
    if (event === FrameEvent.HALF_AND_QUARTER) {
      this.pulse1.tickLengthCounter();
      this.pulse2.tickLengthCounter();
      this.triangle.tickLengthCounter();
      this.noise.tickLengthCounter();
      this.pulse1.tickSweep();
      this.pulse2.tickSweep();
    }
  }

  private pushSample(): void {
    const p1 = this.pulse1.output();
    const p2 = this.pulse2.output();
    const tri = this.triangle.output();
    const noi = this.noise.output();

    // Non-linear mixing (nesdev formulas)
    let pulseOut = 0;
    if (p1 + p2 > 0) {
      pulseOut = 95.88 / (8128.0 / (p1 + p2) + 100.0);
    }

    let tndOut = 0;
    const tndSum = tri / 8227.0 + noi / 12241.0;
    if (tndSum > 0) {
      tndOut = 159.79 / (1.0 / tndSum + 100.0);
    }

    let sample = pulseOut + tndOut;

    // High-pass filter 1 (~37 Hz)
    const prevFilter1Out = this.prevFilterOut1;
    const filtered1 = sample - this.prevSampleIn + 0.999835 * prevFilter1Out;
    this.prevSampleIn = sample;
    this.prevFilterOut1 = filtered1;

    // High-pass filter 2 (~667 Hz) — uses previous filter1 output as its x[n-1]
    const filtered2 = filtered1 - prevFilter1Out + 0.996039 * this.prevFilterOut2;
    this.prevFilterOut2 = filtered2;

    sample = filtered2;

    // Write to ring buffer
    const next = (this.writePos + 1) & (BUFFER_SIZE - 1);
    if (next !== this.readPos) { // don't overflow
      this.sampleBuffer[this.writePos] = sample;
      this.writePos = next;
    }
  }
}
