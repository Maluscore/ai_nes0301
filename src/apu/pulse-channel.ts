import { LengthCounter } from './length-counter';
import { Envelope } from './envelope';

const DUTY_TABLE: readonly (readonly number[])[] = [
  [0, 1, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 0, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 0, 0, 0],
  [1, 0, 0, 1, 1, 1, 1, 1],
];

export class PulseChannel {
  readonly lengthCounter = new LengthCounter();
  readonly envelope = new Envelope();

  private readonly channelIndex: number; // 0 = pulse1, 1 = pulse2

  private dutyMode = 0;
  private dutyPos = 0;
  private timerPeriod = 0;
  private timerValue = 0;

  // Sweep unit
  private sweepEnabled = false;
  private sweepPeriod = 0;
  private sweepNegate = false;
  private sweepShift = 0;
  private sweepReload = false;
  private sweepDivider = 0;

  constructor(channelIndex: number) {
    this.channelIndex = channelIndex;
  }

  writeRegister(reg: number, value: number): void {
    switch (reg) {
      case 0: // $4000/$4004
        this.dutyMode = (value >> 6) & 3;
        this.lengthCounter.setHalt((value & 0x20) !== 0);
        this.envelope.write(value);
        break;
      case 1: // $4001/$4005
        this.sweepEnabled = (value & 0x80) !== 0;
        this.sweepPeriod = (value >> 4) & 7;
        this.sweepNegate = (value & 0x08) !== 0;
        this.sweepShift = value & 7;
        this.sweepReload = true;
        break;
      case 2: // $4002/$4006
        this.timerPeriod = (this.timerPeriod & 0x700) | value;
        break;
      case 3: // $4003/$4007
        this.timerPeriod = (this.timerPeriod & 0xFF) | ((value & 7) << 8);
        this.lengthCounter.load(value >> 3);
        this.dutyPos = 0;
        this.envelope.restart();
        break;
    }
  }

  tickTimer(): void {
    if (this.timerValue === 0) {
      this.timerValue = this.timerPeriod;
      this.dutyPos = (this.dutyPos + 1) & 7;
    } else {
      this.timerValue--;
    }
  }

  tickSweep(): void {
    const target = this.sweepTargetPeriod();
    if (this.sweepDivider === 0 && this.sweepEnabled && !this.isSweepMuting()) {
      this.timerPeriod = target;
    }
    if (this.sweepDivider === 0 || this.sweepReload) {
      this.sweepDivider = this.sweepPeriod;
      this.sweepReload = false;
    } else {
      this.sweepDivider--;
    }
  }

  tickEnvelope(): void {
    this.envelope.clock();
  }

  tickLengthCounter(): void {
    this.lengthCounter.tick();
  }

  output(): number {
    if (!this.lengthCounter.isActive()) return 0;
    if (DUTY_TABLE[this.dutyMode][this.dutyPos] === 0) return 0;
    if (this.isSweepMuting()) return 0;
    return this.envelope.output();
  }

  private sweepTargetPeriod(): number {
    const shift = this.timerPeriod >> this.sweepShift;
    if (this.sweepNegate) {
      // Pulse 1: one's complement (subtract shift+1)
      // Pulse 2: two's complement (subtract shift)
      return this.timerPeriod - shift - (this.channelIndex === 0 ? 1 : 0);
    }
    return this.timerPeriod + shift;
  }

  private isSweepMuting(): boolean {
    return this.timerPeriod < 8 || this.sweepTargetPeriod() > 0x7FF;
  }
}
