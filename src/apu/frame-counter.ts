export const enum FrameEvent {
  NONE = 0,
  QUARTER = 1,       // envelope, linear counter
  HALF_AND_QUARTER = 2, // + length counter, sweep
}

// 4-step sequence (mode 0): steps at CPU cycles 3729, 7457, 11186, 14915
// 5-step sequence (mode 1): steps at CPU cycles 3729, 7457, 11186, 18641
const FOUR_STEP = [3729, 7457, 11186, 14915];
const FIVE_STEP = [3729, 7457, 11186, 14915, 18641];

const FOUR_STEP_EVENTS: readonly FrameEvent[] = [
  FrameEvent.QUARTER,
  FrameEvent.HALF_AND_QUARTER,
  FrameEvent.QUARTER,
  FrameEvent.HALF_AND_QUARTER,
];

const FIVE_STEP_EVENTS: readonly FrameEvent[] = [
  FrameEvent.QUARTER,
  FrameEvent.HALF_AND_QUARTER,
  FrameEvent.QUARTER,
  FrameEvent.NONE,
  FrameEvent.HALF_AND_QUARTER,
];

export class FrameCounter {
  private mode = 0; // 0 = 4-step, 1 = 5-step
  private cycleCounter = 0;
  private stepIndex = 0;


  writeRegister(value: number): FrameEvent {
    this.mode = (value & 0x80) ? 1 : 0;
    this.cycleCounter = 0;
    this.stepIndex = 0;
    // Mode 1: immediately clock quarter + half frame
    if (this.mode === 1) {
      return FrameEvent.HALF_AND_QUARTER;
    }
    return FrameEvent.NONE;
  }

  tick(): FrameEvent {
    this.cycleCounter++;
    const steps = this.mode === 0 ? FOUR_STEP : FIVE_STEP;
    const events = this.mode === 0 ? FOUR_STEP_EVENTS : FIVE_STEP_EVENTS;

    if (this.stepIndex < steps.length && this.cycleCounter >= steps[this.stepIndex]) {
      const event = events[this.stepIndex];
      this.stepIndex++;
      // Reset at end of sequence
      if (this.stepIndex >= steps.length) {
        this.cycleCounter = 0;
        this.stepIndex = 0;
      }
      return event;
    }
    return FrameEvent.NONE;
  }
}
