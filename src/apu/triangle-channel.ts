import { LengthCounter } from './length-counter';

const TRIANGLE_SEQUENCE: readonly number[] = [
  15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
];

export class TriangleChannel {
  readonly lengthCounter = new LengthCounter();

  private sequencePos = 0;
  private timerPeriod = 0;
  private timerValue = 0;

  // Linear counter
  private linearCounter = 0;
  private linearCounterReload = 0;
  private linearReloadFlag = false;
  private controlFlag = false;

  writeRegister(reg: number, value: number): void {
    switch (reg) {
      case 0: // $4008
        this.controlFlag = (value & 0x80) !== 0;
        this.lengthCounter.setHalt(this.controlFlag);
        this.linearCounterReload = value & 0x7F;
        break;
      case 1: // $4009 unused
        break;
      case 2: // $400A
        this.timerPeriod = (this.timerPeriod & 0x700) | value;
        break;
      case 3: // $400B
        this.timerPeriod = (this.timerPeriod & 0xFF) | ((value & 7) << 8);
        this.lengthCounter.load(value >> 3);
        this.linearReloadFlag = true;
        break;
    }
  }

  tickTimer(): void {
    if (this.timerValue === 0) {
      this.timerValue = this.timerPeriod;
      if (this.linearCounter > 0 && this.lengthCounter.isActive()) {
        this.sequencePos = (this.sequencePos + 1) & 31;
      }
    } else {
      this.timerValue--;
    }
  }

  tickLinearCounter(): void {
    if (this.linearReloadFlag) {
      this.linearCounter = this.linearCounterReload;
    } else if (this.linearCounter > 0) {
      this.linearCounter--;
    }
    if (!this.controlFlag) {
      this.linearReloadFlag = false;
    }
  }

  tickLengthCounter(): void {
    this.lengthCounter.tick();
  }

  output(): number {
    if (!this.lengthCounter.isActive()) return 0;
    if (this.linearCounter === 0) return 0;
    if (this.timerPeriod < 2) return 0; // ultrasonic, avoid pops
    return TRIANGLE_SEQUENCE[this.sequencePos];
  }
}
