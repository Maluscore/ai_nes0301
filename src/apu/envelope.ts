export class Envelope {
  private startFlag = false;
  private loopFlag = false;
  private constantFlag = false;
  private volume = 0;    // 4-bit: constant volume or divider period
  private divider = 0;
  private decayLevel = 0;

  write(value: number): void {
    this.constantFlag = (value & 0x10) !== 0;
    this.loopFlag = (value & 0x20) !== 0;
    this.volume = value & 0x0F;
  }

  restart(): void {
    this.startFlag = true;
  }

  clock(): void {
    if (this.startFlag) {
      this.startFlag = false;
      this.decayLevel = 15;
      this.divider = this.volume;
    } else {
      if (this.divider === 0) {
        this.divider = this.volume;
        if (this.decayLevel > 0) {
          this.decayLevel--;
        } else if (this.loopFlag) {
          this.decayLevel = 15;
        }
      } else {
        this.divider--;
      }
    }
  }

  output(): number {
    return this.constantFlag ? this.volume : this.decayLevel;
  }

  getLoopFlag(): boolean {
    return this.loopFlag;
  }
}
