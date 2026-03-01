// CPU Memory Bus - address space routing + OAM DMA

import type { CpuBus } from './cpu';
import type { PPU } from './ppu';
import type { Mapper } from './mapper';
import type { Controller } from './controller';

export class Bus implements CpuBus {
  private readonly ram = new Uint8Array(2048);
  private ppu!: PPU;
  private mapper!: Mapper;
  private controller1!: Controller;
  private controller2!: Controller;

  // DMA state
  dmaPending = false;
  dmaPage = 0;
  dmaTransferring = false;

  connect(ppu: PPU, mapper: Mapper, ctrl1: Controller, ctrl2: Controller): void {
    this.ppu = ppu;
    this.mapper = mapper;
    this.controller1 = ctrl1;
    this.controller2 = ctrl2;
  }

  read(addr: number): number {
    addr &= 0xFFFF;
    if (addr < 0x2000) {
      return this.ram[addr & 0x07FF];
    } else if (addr < 0x4000) {
      return this.ppu.readRegister(addr);
    } else if (addr === 0x4016) {
      return this.controller1.read();
    } else if (addr === 0x4017) {
      return this.controller2.read();
    } else if (addr < 0x4020) {
      // APU & IO registers - return 0 (APU not implemented)
      return 0;
    } else {
      return this.mapper.cpuRead(addr);
    }
  }

  write(addr: number, value: number): void {
    addr &= 0xFFFF;
    if (addr < 0x2000) {
      this.ram[addr & 0x07FF] = value;
    } else if (addr < 0x4000) {
      this.ppu.writeRegister(addr, value);
    } else if (addr === 0x4014) {
      // OAM DMA
      this.dmaPage = value;
      this.dmaPending = true;
    } else if (addr === 0x4016) {
      this.controller1.write(value);
      this.controller2.write(value);
    } else if (addr < 0x4020) {
      // APU registers - ignore
    } else {
      this.mapper.cpuWrite(addr, value);
    }
  }

  // Execute OAM DMA transfer - reads from (dmaPage << 8) to PPU OAM
  executeDma(): void {
    const baseAddr = this.dmaPage << 8;
    const data = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      data[i] = this.read(baseAddr + i);
    }
    this.ppu.writeOamDma(data, 0);
  }
}
