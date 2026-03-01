const LENGTH_TABLE: readonly number[] = [
  10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14,
  12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30,
];

export class LengthCounter {
  private counter = 0;
  private enabled = false;
  private halt = false;

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.counter = 0;
  }

  setHalt(halt: boolean): void {
    this.halt = halt;
  }

  load(index: number): void {
    if (this.enabled) {
      this.counter = LENGTH_TABLE[index & 0x1F];
    }
  }

  tick(): void {
    if (!this.halt && this.counter > 0) {
      this.counter--;
    }
  }

  isActive(): boolean {
    return this.counter > 0;
  }

  value(): number {
    return this.counter;
  }
}
