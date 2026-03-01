import { NES } from './nes';
import { Renderer } from './renderer';
import { AudioOutput } from './audio-output';
import { bindKeyboard } from './controller';

const ROM_URL = '/mario.nes';

async function main() {
  const canvas = document.getElementById('screen') as HTMLCanvasElement;
  const status = document.getElementById('status') as HTMLDivElement;
  const muteBtn = document.getElementById('mute-btn') as HTMLButtonElement;

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

  // Audio setup
  const audio = new AudioOutput();
  audio.connectAPU(nes.apu);
  await audio.init();

  // Resume audio on first user interaction (browser autoplay policy)
  const resumeAudio = async () => {
    await audio.resume();
    document.removeEventListener('click', resumeAudio);
    document.removeEventListener('keydown', resumeAudio);
  };
  document.addEventListener('click', resumeAudio);
  document.addEventListener('keydown', resumeAudio);

  // Mute toggle
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const muted = audio.toggleMute();
      muteBtn.textContent = muted ? 'Unmute (M)' : 'Mute (M)';
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') {
      const muted = audio.toggleMute();
      if (muteBtn) muteBtn.textContent = muted ? 'Unmute (M)' : 'Mute (M)';
    }
  });

  status.textContent = 'Arrow keys/WASD: move | X/K: A | Z/J: B | Enter: Start | Shift: Select | M: Mute';

  let lastTime = 0;
  const FRAME_TIME = 1000 / 60.0988;

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
