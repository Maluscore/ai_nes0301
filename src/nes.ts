// NES System - component orchestration + CPU/PPU/APU synchronization

import { CPU } from './cpu';
import { PPU } from './ppu';
import { Bus } from './bus';
import { Controller } from './controller';
import { APU } from './apu/apu';
import { type CartridgeData, parseRom } from './cartridge';
import { createMapper, type Mapper } from './mapper';

export class NES {
  readonly cpu: CPU;
  readonly ppu: PPU;
  readonly apu: APU;
  readonly bus: Bus;
  readonly controller1: Controller;
  readonly controller2: Controller;

  private mapper: Mapper;
  private totalCycles = 0;

  constructor(romBuffer: ArrayBuffer) {
    const cart: CartridgeData = parseRom(romBuffer);
    this.mapper = createMapper(cart);

    this.ppu = new PPU();
    this.ppu.setMapper(this.mapper);

    this.apu = new APU();

    this.bus = new Bus();
    this.controller1 = new Controller();
    this.controller2 = new Controller();
    this.bus.connect(this.ppu, this.mapper, this.controller1, this.controller2, this.apu);

    this.cpu = new CPU(this.bus);
  }

  reset(): void {
    this.ppu.reset();
    this.apu.reset();
    this.cpu.reset();
    this.totalCycles = 0;
  }

  // Run one full frame (until PPU completes 262 scanlines)
  frame(): void {
    const startFrame = this.ppu.frame;
    while (this.ppu.frame === startFrame) {
      this.step();
    }
  }

  // Run one CPU instruction + corresponding PPU cycles
  private step(): void {
    // Handle pending DMA
    if (this.bus.dmaPending) {
      this.bus.dmaPending = false;
      this.bus.executeDma();
      // DMA takes 513 or 514 cycles
      const dmaCycles = (this.totalCycles & 1) ? 514 : 513;
      for (let i = 0; i < dmaCycles * 3; i++) {
        this.ppu.tick();
        this.checkNmi();
      }
      this.apu.tick(dmaCycles);
      this.totalCycles += dmaCycles;
      return;
    }

    const cpuCycles = this.cpu.step();
    this.totalCycles += cpuCycles;

    // PPU runs at 3x CPU clock
    for (let i = 0; i < cpuCycles * 3; i++) {
      this.ppu.tick();
      this.checkNmi();
    }

    // APU runs at 1x CPU clock
    this.apu.tick(cpuCycles);
  }

  private checkNmi(): void {
    if (this.ppu.triggerNmi) {
      this.ppu.triggerNmi = false;
      this.cpu.nmiPending = true;
    }
  }
}
