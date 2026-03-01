// Ricoh 2C02 PPU - Picture Processing Unit

import { MirrorMode } from './cartridge';
import type { Mapper } from './mapper';

export class PPU {
  // Public framebuffer - palette indices (256x240)
  readonly framebuffer = new Uint8Array(256 * 240);

  // VRAM
  private readonly nametableRam = new Uint8Array(2048);
  private readonly paletteRam = new Uint8Array(32);
  private readonly oam = new Uint8Array(256);

  // Rendering state
  cycle = 0;     // 0-340
  scanline = 0;  // 0-261
  frame = 0;

  // PPU registers
  private ctrl = 0;    // $2000 VPHB SINN
  private mask = 0;    // $2001 BGRs bMmG
  private status = 0;  // $2002 VSO- ----
  private oamAddr = 0; // $2003

  // Loopy scroll registers
  private v = 0;     // Current VRAM address (15 bit)
  private t = 0;     // Temporary VRAM address (15 bit)
  private fineX = 0; // Fine X scroll (3 bit)
  private w = 0;     // Write toggle (1 bit)

  // Internal data buffer for $2007 reads
  private dataBuffer = 0;

  // Background shift registers (16-bit)
  private bgShiftLo = 0;
  private bgShiftHi = 0;
  private attrShiftLo = 0;
  private attrShiftHi = 0;

  // Background fetch temporaries
  private ntByte = 0;
  private atByte = 0;
  private bgLo = 0;
  private bgHi = 0;

  // Sprite rendering
  private readonly spriteScanline = new Uint8Array(32); // 8 sprites * 4 bytes
  private readonly spriteShiftLo = new Uint8Array(8);
  private readonly spriteShiftHi = new Uint8Array(8);
  private spriteCount = 0;
  private sprite0OnLine = false;

  // NMI
  nmiOutput = false;   // controlled by $2000 bit 7
  nmiOccurred = false; // set at scanline 241

  // Flags for external signaling
  triggerNmi = false;

  private mapper!: Mapper;
  private mirrorMode: MirrorMode = MirrorMode.Vertical;

  setMapper(mapper: Mapper): void {
    this.mapper = mapper;
    this.mirrorMode = mapper.mirror;
  }

  reset(): void {
    this.ctrl = 0;
    this.mask = 0;
    this.status = 0;
    this.oamAddr = 0;
    this.v = 0;
    this.t = 0;
    this.fineX = 0;
    this.w = 0;
    this.dataBuffer = 0;
    this.cycle = 0;
    this.scanline = 0;
    this.frame = 0;
    this.nmiOutput = false;
    this.nmiOccurred = false;
    this.triggerNmi = false;
  }

  // CPU-facing register reads ($2000-$2007)
  readRegister(addr: number): number {
    switch (addr & 7) {
      case 2: return this.readStatus();
      case 4: return this.oam[this.oamAddr];
      case 7: return this.readData();
      default: return 0;
    }
  }

  // CPU-facing register writes ($2000-$2007)
  writeRegister(addr: number, value: number): void {
    switch (addr & 7) {
      case 0: this.writeCtrl(value); break;
      case 1: this.mask = value; break;
      case 3: this.oamAddr = value; break;
      case 4:
        this.oam[this.oamAddr] = value;
        this.oamAddr = (this.oamAddr + 1) & 0xFF;
        break;
      case 5: this.writeScroll(value); break;
      case 6: this.writeAddr(value); break;
      case 7: this.writeData(value); break;
    }
  }

  writeOamDma(data: Uint8Array, startAddr: number): void {
    for (let i = 0; i < 256; i++) {
      this.oam[(this.oamAddr + i) & 0xFF] = data[(startAddr + i) & 0xFF];
    }
  }

  private writeCtrl(value: number): void {
    this.ctrl = value;
    // t: ...GH.. ........ = d: ......GH
    this.t = (this.t & 0x73FF) | ((value & 0x03) << 10);
    const prevNmiOutput = this.nmiOutput;
    this.nmiOutput = (value & 0x80) !== 0;
    // Rising edge of nmiOutput while nmiOccurred is set
    if (!prevNmiOutput && this.nmiOutput && this.nmiOccurred) {
      this.triggerNmi = true;
    }
  }

  private readStatus(): number {
    const result = this.status & 0xE0;
    this.nmiOccurred = false;
    this.status &= ~0x80;
    this.w = 0;
    return result;
  }

  private writeScroll(value: number): void {
    if (this.w === 0) {
      // First write: X scroll
      this.t = (this.t & 0x7FE0) | (value >> 3);
      this.fineX = value & 0x07;
      this.w = 1;
    } else {
      // Second write: Y scroll
      this.t = (this.t & 0x0C1F) | ((value & 0x07) << 12) | ((value & 0xF8) << 2);
      this.w = 0;
    }
  }

  private writeAddr(value: number): void {
    if (this.w === 0) {
      // First write: high byte
      this.t = (this.t & 0x00FF) | ((value & 0x3F) << 8);
      this.w = 1;
    } else {
      // Second write: low byte
      this.t = (this.t & 0x7F00) | value;
      this.v = this.t;
      this.w = 0;
    }
  }

  private readData(): number {
    let result = this.ppuRead(this.v & 0x3FFF);
    if ((this.v & 0x3FFF) < 0x3F00) {
      const buffered = this.dataBuffer;
      this.dataBuffer = result;
      result = buffered;
    } else {
      this.dataBuffer = this.ppuRead(this.v - 0x1000);
    }
    this.v = (this.v + ((this.ctrl & 0x04) ? 32 : 1)) & 0x7FFF;
    return result;
  }

  private writeData(value: number): void {
    this.ppuWrite(this.v & 0x3FFF, value);
    this.v = (this.v + ((this.ctrl & 0x04) ? 32 : 1)) & 0x7FFF;
  }

  // PPU memory map
  private ppuRead(addr: number): number {
    addr &= 0x3FFF;
    if (addr < 0x2000) {
      return this.mapper.ppuRead(addr);
    } else if (addr < 0x3F00) {
      return this.nametableRam[this.mirrorAddr(addr)];
    } else {
      return this.paletteRam[this.paletteAddr(addr)];
    }
  }

  private ppuWrite(addr: number, value: number): void {
    addr &= 0x3FFF;
    if (addr < 0x2000) {
      this.mapper.ppuWrite(addr, value);
    } else if (addr < 0x3F00) {
      this.nametableRam[this.mirrorAddr(addr)] = value;
    } else {
      this.paletteRam[this.paletteAddr(addr)] = value;
    }
  }

  private mirrorAddr(addr: number): number {
    addr = (addr - 0x2000) & 0x0FFF;
    switch (this.mirrorMode) {
      case MirrorMode.Vertical:
        return addr & 0x07FF;
      case MirrorMode.Horizontal:
        return ((addr & 0x0400) >> 1) | (addr & 0x03FF);
      case MirrorMode.FourScreen:
        return addr;
      default:
        return addr & 0x07FF;
    }
  }

  private paletteAddr(addr: number): number {
    let idx = addr & 0x1F;
    if (idx >= 16 && (idx & 3) === 0) idx -= 16;
    return idx;
  }

  // Main PPU tick - called 3x per CPU cycle
  tick(): void {
    const rendering = this.isRenderingEnabled();
    const visibleLine = this.scanline < 240;
    const preLine = this.scanline === 261;
    const renderLine = visibleLine || preLine;
    const visibleCycle = this.cycle >= 1 && this.cycle <= 256;
    const fetchCycle = (this.cycle >= 1 && this.cycle <= 256) || (this.cycle >= 321 && this.cycle <= 336);

    if (rendering) {
      // CRITICAL: Output pixel BEFORE shifting registers
      if (visibleLine && visibleCycle) {
        this.renderPixel();
      }

      // Background shift + fetch
      if (renderLine && fetchCycle) {
        this.updateShifters();
        this.backgroundFetch();
      }

      // Sprite evaluation at cycle 257
      if (visibleLine && this.cycle === 257) {
        this.evaluateSprites();
      }

      // Sprite pattern fetch
      if (renderLine && this.cycle === 321) {
        this.loadSpritePatterns();
      }

      // Scroll updates
      if (renderLine) {
        if (fetchCycle && (this.cycle & 7) === 0) {
          this.incrementX();
        }
        if (this.cycle === 256) {
          this.incrementY();
        }
        if (this.cycle === 257) {
          this.copyHorizontal();
        }
      }

      if (preLine && this.cycle >= 280 && this.cycle <= 304) {
        this.copyVertical();
      }
    }

    // VBlank and flags
    if (this.scanline === 241 && this.cycle === 1) {
      this.nmiOccurred = true;
      this.status |= 0x80;
      if (this.nmiOutput) {
        this.triggerNmi = true;
      }
    }

    if (preLine && this.cycle === 1) {
      this.nmiOccurred = false;
      this.status &= ~0xE0; // Clear vblank, sprite 0, overflow
    }

    // Advance position
    this.cycle++;
    if (this.cycle > 340) {
      this.cycle = 0;
      this.scanline++;
      if (this.scanline > 261) {
        this.scanline = 0;
        this.frame++;
      }
    }

    // Odd frame skip
    if (rendering && preLine && this.cycle === 340 && (this.frame & 1) !== 0) {
      this.cycle = 0;
      this.scanline = 0;
      this.frame++;
    }
  }

  private isRenderingEnabled(): boolean {
    return (this.mask & 0x18) !== 0;
  }

  private updateShifters(): void {
    this.bgShiftLo <<= 1;
    this.bgShiftHi <<= 1;
    this.attrShiftLo <<= 1;
    this.attrShiftHi <<= 1;
  }

  private backgroundFetch(): void {
    switch (this.cycle & 7) {
      case 1: // Nametable byte
        this.ntByte = this.ppuRead(0x2000 | (this.v & 0x0FFF));
        break;
      case 3: { // Attribute table byte
        const atAddr = 0x23C0 | (this.v & 0x0C00) | ((this.v >> 4) & 0x38) | ((this.v >> 2) & 0x07);
        this.atByte = this.ppuRead(atAddr);
        if (this.v & 0x40) this.atByte >>= 4;
        if (this.v & 0x02) this.atByte >>= 2;
        this.atByte &= 3;
        break;
      }
      case 5: { // Pattern table low byte
        const patBase = (this.ctrl & 0x10) ? 0x1000 : 0;
        const fineY = (this.v >> 12) & 7;
        this.bgLo = this.ppuRead(patBase + this.ntByte * 16 + fineY);
        break;
      }
      case 7: { // Pattern table high byte
        const patBase = (this.ctrl & 0x10) ? 0x1000 : 0;
        const fineY = (this.v >> 12) & 7;
        this.bgHi = this.ppuRead(patBase + this.ntByte * 16 + fineY + 8);
        break;
      }
      case 0: // Load into shift registers
        this.loadBackgroundShifters();
        break;
    }
  }

  private loadBackgroundShifters(): void {
    // Pattern data: keep high byte (current tile), load low byte (next tile)
    this.bgShiftLo = (this.bgShiftLo & 0xFF00) | this.bgLo;
    this.bgShiftHi = (this.bgShiftHi & 0xFF00) | this.bgHi;
    // Attribute data: expand 2-bit attribute to fill 8 bits in low byte
    this.attrShiftLo = (this.attrShiftLo & 0xFF00) | ((this.atByte & 1) ? 0xFF : 0x00);
    this.attrShiftHi = (this.attrShiftHi & 0xFF00) | ((this.atByte & 2) ? 0xFF : 0x00);
  }

  private incrementX(): void {
    if ((this.v & 0x001F) === 31) {
      this.v &= ~0x001F;
      this.v ^= 0x0400;
    } else {
      this.v++;
    }
  }

  private incrementY(): void {
    if ((this.v & 0x7000) !== 0x7000) {
      this.v += 0x1000;
    } else {
      this.v &= ~0x7000;
      let coarseY = (this.v & 0x03E0) >> 5;
      if (coarseY === 29) {
        coarseY = 0;
        this.v ^= 0x0800;
      } else if (coarseY === 31) {
        coarseY = 0;
      } else {
        coarseY++;
      }
      this.v = (this.v & ~0x03E0) | (coarseY << 5);
    }
  }

  private copyHorizontal(): void {
    this.v = (this.v & ~0x041F) | (this.t & 0x041F);
  }

  private copyVertical(): void {
    this.v = (this.v & ~0x7BE0) | (this.t & 0x7BE0);
  }

  private evaluateSprites(): void {
    this.spriteCount = 0;
    this.sprite0OnLine = false;
    const spriteHeight = (this.ctrl & 0x20) ? 16 : 8;

    for (let i = 0; i < 64 && this.spriteCount < 8; i++) {
      const y = this.oam[i * 4];
      const diff = this.scanline - y;
      if (diff >= 0 && diff < spriteHeight) {
        if (i === 0) this.sprite0OnLine = true;
        const offset = this.spriteCount * 4;
        this.spriteScanline[offset] = this.oam[i * 4];
        this.spriteScanline[offset + 1] = this.oam[i * 4 + 1];
        this.spriteScanline[offset + 2] = this.oam[i * 4 + 2];
        this.spriteScanline[offset + 3] = this.oam[i * 4 + 3];
        this.spriteCount++;
      }
    }
  }

  private loadSpritePatterns(): void {
    const spriteHeight = (this.ctrl & 0x20) ? 16 : 8;

    for (let i = 0; i < this.spriteCount; i++) {
      const offset = i * 4;
      const y = this.spriteScanline[offset];
      const tile = this.spriteScanline[offset + 1];
      const attr = this.spriteScanline[offset + 2];
      let row = this.scanline - y;

      const flipV = (attr & 0x80) !== 0;

      let patternAddr: number;
      if (spriteHeight === 8) {
        if (flipV) row = 7 - row;
        const patBase = (this.ctrl & 0x08) ? 0x1000 : 0;
        patternAddr = patBase + tile * 16 + row;
      } else {
        if (flipV) row = 15 - row;
        const table = tile & 1;
        const tileNum = tile & 0xFE;
        if (row >= 8) {
          patternAddr = table * 0x1000 + (tileNum + 1) * 16 + (row - 8);
        } else {
          patternAddr = table * 0x1000 + tileNum * 16 + row;
        }
      }

      let lo = this.ppuRead(patternAddr);
      let hi = this.ppuRead(patternAddr + 8);

      if (attr & 0x40) {
        lo = this.reverseByte(lo);
        hi = this.reverseByte(hi);
      }

      this.spriteShiftLo[i] = lo;
      this.spriteShiftHi[i] = hi;
    }
  }

  private reverseByte(b: number): number {
    b = ((b & 0xF0) >> 4) | ((b & 0x0F) << 4);
    b = ((b & 0xCC) >> 2) | ((b & 0x33) << 2);
    b = ((b & 0xAA) >> 1) | ((b & 0x55) << 1);
    return b;
  }

  private renderPixel(): void {
    const x = this.cycle - 1;

    // Background pixel
    let bgPixel = 0;
    let bgPalette = 0;
    if (this.mask & 0x08) {
      if ((this.mask & 0x02) || x >= 8) {
        const shift = 15 - this.fineX;
        bgPixel = ((this.bgShiftLo >> shift) & 1) | (((this.bgShiftHi >> shift) & 1) << 1);
        bgPalette = ((this.attrShiftLo >> shift) & 1) | (((this.attrShiftHi >> shift) & 1) << 1);
      }
    }
    if (bgPixel === 0) bgPalette = 0;

    // Sprite pixel
    let sprPixel = 0;
    let sprPalette = 0;
    let sprPriority = 0;
    let spriteIdx = -1;
    if (this.mask & 0x10) {
      if ((this.mask & 0x04) || x >= 8) {
        for (let i = 0; i < this.spriteCount; i++) {
          const sprX = this.spriteScanline[i * 4 + 3];
          const diff = x - sprX;
          if (diff >= 0 && diff < 8) {
            const bit = 7 - diff;
            const lo = (this.spriteShiftLo[i] >> bit) & 1;
            const hi = (this.spriteShiftHi[i] >> bit) & 1;
            const pixel = (hi << 1) | lo;
            if (pixel !== 0) {
              sprPixel = pixel;
              const attr = this.spriteScanline[i * 4 + 2];
              sprPalette = (attr & 3) + 4;
              sprPriority = (attr & 0x20) !== 0 ? 1 : 0;
              spriteIdx = i;
              break;
            }
          }
        }
      }
    }

    // Sprite 0 hit detection
    if (this.sprite0OnLine && spriteIdx === 0 && bgPixel !== 0 && sprPixel !== 0 && x < 255) {
      this.status |= 0x40;
    }

    // Priority multiplexer
    let finalColor: number;
    if (bgPixel === 0 && sprPixel === 0) {
      finalColor = this.ppuRead(0x3F00);
    } else if (bgPixel === 0) {
      finalColor = this.ppuRead(0x3F00 + sprPalette * 4 + sprPixel);
    } else if (sprPixel === 0) {
      finalColor = this.ppuRead(0x3F00 + bgPalette * 4 + bgPixel);
    } else if (sprPriority === 0) {
      finalColor = this.ppuRead(0x3F00 + sprPalette * 4 + sprPixel);
    } else {
      finalColor = this.ppuRead(0x3F00 + bgPalette * 4 + bgPixel);
    }

    this.framebuffer[this.scanline * 256 + x] = finalColor & 0x3F;
  }
}
