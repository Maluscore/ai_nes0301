export const enum Button {
  A      = 0,
  B      = 1,
  Select = 2,
  Start  = 3,
  Up     = 4,
  Down   = 5,
  Left   = 6,
  Right  = 7,
}

export class Controller {
  private buttons = 0;
  private shiftReg = 0;
  private strobe = false;

  press(button: Button): void {
    this.buttons |= (1 << button);
  }

  release(button: Button): void {
    this.buttons &= ~(1 << button);
  }

  write(value: number): void {
    this.strobe = (value & 1) !== 0;
    if (this.strobe) {
      this.shiftReg = this.buttons;
    }
  }

  read(): number {
    if (this.strobe) {
      return this.buttons & 1; // continuously reload and return A
    }
    const bit = this.shiftReg & 1;
    this.shiftReg >>= 1;
    return bit | 0x40; // open bus bits
  }
}

const KEY_MAP: Record<string, Button> = {
  'KeyX':       Button.A,
  'KeyK':       Button.A,
  'KeyZ':       Button.B,
  'KeyJ':       Button.B,
  'ShiftRight': Button.Select,
  'ShiftLeft':  Button.Select,
  'Enter':      Button.Start,
  'ArrowUp':    Button.Up,
  'KeyW':       Button.Up,
  'ArrowDown':  Button.Down,
  'KeyS':       Button.Down,
  'ArrowLeft':  Button.Left,
  'KeyA':       Button.Left,
  'ArrowRight': Button.Right,
  'KeyD':       Button.Right,
};

export function bindKeyboard(controller: Controller): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const btn = KEY_MAP[e.code];
    if (btn !== undefined) {
      e.preventDefault();
      controller.press(btn);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const btn = KEY_MAP[e.code];
    if (btn !== undefined) {
      e.preventDefault();
      controller.release(btn);
    }
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
