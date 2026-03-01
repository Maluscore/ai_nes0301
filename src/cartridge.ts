export const enum MirrorMode {
  Horizontal = 0,
  Vertical = 1,
  FourScreen = 2,
}

export interface CartridgeData {
  readonly prgRom: Uint8Array;
  readonly chrRom: Uint8Array;
  readonly mapperId: number;
  readonly mirror: MirrorMode;
  readonly prgBanks: number;
  readonly chrBanks: number;
}

const INES_MAGIC = 0x1a53454e; // "NES\x1a"

export function parseRom(buffer: ArrayBuffer): CartridgeData {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);

  const magic = view.getUint32(0, true);
  if (magic !== INES_MAGIC) {
    throw new Error('Invalid iNES ROM: bad magic number');
  }

  const prgBanks = data[4];
  const chrBanks = data[5];
  const flags6 = data[6];
  const flags7 = data[7];

  const mapperId = (flags7 & 0xf0) | (flags6 >> 4);

  let mirror: MirrorMode;
  if (flags6 & 0x08) {
    mirror = MirrorMode.FourScreen;
  } else {
    mirror = (flags6 & 0x01) ? MirrorMode.Vertical : MirrorMode.Horizontal;
  }

  const hasTrainer = (flags6 & 0x04) !== 0;
  const headerSize = 16;
  const trainerSize = hasTrainer ? 512 : 0;

  const prgStart = headerSize + trainerSize;
  const prgSize = prgBanks * 16384;
  const chrStart = prgStart + prgSize;
  const chrSize = chrBanks * 8192;

  const prgRom = data.slice(prgStart, prgStart + prgSize);
  const chrRom = chrBanks > 0
    ? data.slice(chrStart, chrStart + chrSize)
    : new Uint8Array(8192); // CHR RAM

  return { prgRom, chrRom, mapperId, mirror, prgBanks, chrBanks };
}
