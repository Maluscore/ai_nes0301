import { LengthCounter } from './length-counter';
import { Envelope } from './envelope';

const NOISE_PERIOD_TABLE: readonly number[] = [
  4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068,
];

export class NoiseChannel {
  readonly lengthCounter = new LengthCounter();
  readonly envelope = new Envelope();

  private shiftRegister = 1;
  private modeFlag = false;
  private timerPeriod = 0;
  private timerValue = 0;

  writeRegister(reg: number, value: number): void {
    switch (reg) {
      case 0: // $400C
        this.lengthCounter.setHalt((value & 0x20) !== 0);
        this.envelope.write(value);
        break;
      case 1: // $400D unused
        break;
      case 2: // $400E
        this.modeFlag = (value & 0x80) !== 0;
        this.timerPeriod = NOISE_PERIOD_TABLE[value & 0x0F];
        break;
      case 3: // $400F
        this.lengthCounter.load(value >> 3);
        this.envelope.restart();
        break;
    }
  }

  tickTimer(): void {
    if (this.timerValue === 0) {
      this.timerValue = this.timerPeriod;
      // LFSR feedback
      const bit = this.modeFlag ? 6 : 1;
      const feedback = (this.shiftRegister & 1) ^ ((this.shiftRegister >> bit) & 1);
      this.shiftRegister = (this.shiftRegister >> 1) | (feedback << 14);
    } else {
      this.timerValue--;
    }
  }

  tickEnvelope(): void {
    this.envelope.clock();
  }

  tickLengthCounter(): void {
    this.lengthCounter.tick();
  }

  output(): number {
    if (this.shiftRegister & 1) return 0;
    if (!this.lengthCounter.isActive()) return 0;
    return this.envelope.output();
  }
}
