import { type CartridgeData, MirrorMode } from './cartridge';

export interface Mapper {
  readonly mirror: MirrorMode;
  cpuRead(addr: number): number;
  cpuWrite(addr: number, value: number): void;
  ppuRead(addr: number): number;
  ppuWrite(addr: number, value: number): void;
}

export function createMapper(cart: CartridgeData): Mapper {
  switch (cart.mapperId) {
    case 0: return new Mapper0(cart);
    default: throw new Error(`Unsupported mapper: ${cart.mapperId}`);
  }
}

class Mapper0 implements Mapper {
  readonly mirror: MirrorMode;
  private readonly prgRom: Uint8Array;
  private readonly chrRom: Uint8Array;
  private readonly prgMask: number;

  constructor(cart: CartridgeData) {
    this.mirror = cart.mirror;
    this.prgRom = cart.prgRom;
    this.chrRom = cart.chrRom;
    // 16KB (1 bank) mirrors to fill 32KB, 32KB (2 banks) maps directly
    this.prgMask = cart.prgRom.length - 1;
  }

  cpuRead(addr: number): number {
    if (addr >= 0x8000) {
      return this.prgRom[(addr - 0x8000) & this.prgMask];
    }
    return 0;
  }

  cpuWrite(_addr: number, _value: number): void {
    // NROM has no writable registers
  }

  ppuRead(addr: number): number {
    if (addr < 0x2000) {
      return this.chrRom[addr];
    }
    return 0;
  }

  ppuWrite(addr: number, value: number): void {
    // CHR RAM write (if no CHR ROM banks)
    if (addr < 0x2000) {
      this.chrRom[addr] = value;
    }
  }
}
