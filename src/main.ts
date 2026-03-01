import { NES } from './nes';
import { Renderer } from './renderer';
import { bindKeyboard } from './controller';

const ROM_URL = '/mario.nes';

async function main() {
  const canvas = document.getElementById('screen') as HTMLCanvasElement;
  const status = document.getElementById('status') as HTMLDivElement;

  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  status.textContent = 'Loading ROM...';

  const response = await fetch(ROM_URL);
  if (!response.ok) {
    status.textContent = `Failed to load ROM: ${response.statusText}`;
    return;
  }
  const romBuffer = await response.arrayBuffer();

  status.textContent = 'Initializing...';

  const nes = new NES(romBuffer);
  nes.reset();

  const renderer = new Renderer(canvas);
  bindKeyboard(nes.controller1);

  status.textContent = 'Running - Arrow keys/WASD: move | X/K: A | Z/J: B | Enter: Start | Shift: Select';

  let lastTime = 0;
  const FRAME_TIME = 1000 / 60.0988; // NTSC ~60.0988 fps

  function loop(timestamp: number) {
    if (lastTime === 0) lastTime = timestamp;

    const elapsed = timestamp - lastTime;

    if (elapsed >= FRAME_TIME) {
      lastTime = timestamp - (elapsed % FRAME_TIME);
      nes.frame();
      renderer.render(nes.ppu.framebuffer);
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main().catch(console.error);
