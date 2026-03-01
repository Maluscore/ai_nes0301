import { SYSTEM_PALETTE } from './palette';

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly imageData: ImageData;
  private readonly buf32: Uint32Array;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context');
    this.ctx = ctx;
    this.imageData = ctx.createImageData(256, 240);
    this.buf32 = new Uint32Array(this.imageData.data.buffer);
  }

  render(framebuffer: Uint8Array): void {
    const buf = this.buf32;
    for (let i = 0; i < 256 * 240; i++) {
      const color = SYSTEM_PALETTE[framebuffer[i] & 0x3f];
      // ABGR format for little-endian
      buf[i] = 0xff000000
        | ((color & 0xff) << 16)
        | (color & 0xff00)
        | ((color >> 16) & 0xff);
    }
    this.ctx.putImageData(this.imageData, 0, 0);
  }
}
