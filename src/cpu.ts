// Ricoh 2A03 (MOS 6502 without BCD mode)

export interface CpuBus {
  read(addr: number): number;
  write(addr: number, value: number): void;
}

const enum Flag {
  C = 0x01, // Carry
  Z = 0x02, // Zero
  I = 0x04, // Interrupt disable
  D = 0x08, // Decimal (unused on NES)
  B = 0x10, // Break
  U = 0x20, // Unused (always 1)
  V = 0x40, // Overflow
  N = 0x80, // Negative
}

// Addressing modes
const enum Mode {
  IMP, ACC, IMM, ZPG, ZPX, ZPY, ABS, ABX, ABY, IND, IZX, IZY, REL,
}

interface Instruction {
  op: string;
  mode: Mode;
  cycles: number;
}

// Build instruction table
function buildTable(): (Instruction | null)[] {
  const t: (Instruction | null)[] = new Array(256).fill(null);

  function def(opcode: number, op: string, mode: Mode, cycles: number) {
    t[opcode] = { op, mode, cycles };
  }

  // ADC
  def(0x69, 'ADC', Mode.IMM, 2); def(0x65, 'ADC', Mode.ZPG, 3);
  def(0x75, 'ADC', Mode.ZPX, 4); def(0x6D, 'ADC', Mode.ABS, 4);
  def(0x7D, 'ADC', Mode.ABX, 4); def(0x79, 'ADC', Mode.ABY, 4);
  def(0x61, 'ADC', Mode.IZX, 6); def(0x71, 'ADC', Mode.IZY, 5);
  // AND
  def(0x29, 'AND', Mode.IMM, 2); def(0x25, 'AND', Mode.ZPG, 3);
  def(0x35, 'AND', Mode.ZPX, 4); def(0x2D, 'AND', Mode.ABS, 4);
  def(0x3D, 'AND', Mode.ABX, 4); def(0x39, 'AND', Mode.ABY, 4);
  def(0x21, 'AND', Mode.IZX, 6); def(0x31, 'AND', Mode.IZY, 5);
  // ASL
  def(0x0A, 'ASL', Mode.ACC, 2); def(0x06, 'ASL', Mode.ZPG, 5);
  def(0x16, 'ASL', Mode.ZPX, 6); def(0x0E, 'ASL', Mode.ABS, 6);
  def(0x1E, 'ASL', Mode.ABX, 7);
  // BCC/BCS/BEQ/BMI/BNE/BPL/BVC/BVS
  def(0x90, 'BCC', Mode.REL, 2); def(0xB0, 'BCS', Mode.REL, 2);
  def(0xF0, 'BEQ', Mode.REL, 2); def(0x30, 'BMI', Mode.REL, 2);
  def(0xD0, 'BNE', Mode.REL, 2); def(0x10, 'BPL', Mode.REL, 2);
  def(0x50, 'BVC', Mode.REL, 2); def(0x70, 'BVS', Mode.REL, 2);
  // BIT
  def(0x24, 'BIT', Mode.ZPG, 3); def(0x2C, 'BIT', Mode.ABS, 4);
  // BRK
  def(0x00, 'BRK', Mode.IMP, 7);
  // CLC/CLD/CLI/CLV
  def(0x18, 'CLC', Mode.IMP, 2); def(0xD8, 'CLD', Mode.IMP, 2);
  def(0x58, 'CLI', Mode.IMP, 2); def(0xB8, 'CLV', Mode.IMP, 2);
  // CMP
  def(0xC9, 'CMP', Mode.IMM, 2); def(0xC5, 'CMP', Mode.ZPG, 3);
  def(0xD5, 'CMP', Mode.ZPX, 4); def(0xCD, 'CMP', Mode.ABS, 4);
  def(0xDD, 'CMP', Mode.ABX, 4); def(0xD9, 'CMP', Mode.ABY, 4);
  def(0xC1, 'CMP', Mode.IZX, 6); def(0xD1, 'CMP', Mode.IZY, 5);
  // CPX
  def(0xE0, 'CPX', Mode.IMM, 2); def(0xE4, 'CPX', Mode.ZPG, 3);
  def(0xEC, 'CPX', Mode.ABS, 4);
  // CPY
  def(0xC0, 'CPY', Mode.IMM, 2); def(0xC4, 'CPY', Mode.ZPG, 3);
  def(0xCC, 'CPY', Mode.ABS, 4);
  // DEC
  def(0xC6, 'DEC', Mode.ZPG, 5); def(0xD6, 'DEC', Mode.ZPX, 6);
  def(0xCE, 'DEC', Mode.ABS, 6); def(0xDE, 'DEC', Mode.ABX, 7);
  // DEX/DEY
  def(0xCA, 'DEX', Mode.IMP, 2); def(0x88, 'DEY', Mode.IMP, 2);
  // EOR
  def(0x49, 'EOR', Mode.IMM, 2); def(0x45, 'EOR', Mode.ZPG, 3);
  def(0x55, 'EOR', Mode.ZPX, 4); def(0x4D, 'EOR', Mode.ABS, 4);
  def(0x5D, 'EOR', Mode.ABX, 4); def(0x59, 'EOR', Mode.ABY, 4);
  def(0x41, 'EOR', Mode.IZX, 6); def(0x51, 'EOR', Mode.IZY, 5);
  // INC
  def(0xE6, 'INC', Mode.ZPG, 5); def(0xF6, 'INC', Mode.ZPX, 6);
  def(0xEE, 'INC', Mode.ABS, 6); def(0xFE, 'INC', Mode.ABX, 7);
  // INX/INY
  def(0xE8, 'INX', Mode.IMP, 2); def(0xC8, 'INY', Mode.IMP, 2);
  // JMP
  def(0x4C, 'JMP', Mode.ABS, 3); def(0x6C, 'JMP', Mode.IND, 5);
  // JSR
  def(0x20, 'JSR', Mode.ABS, 6);
  // LDA
  def(0xA9, 'LDA', Mode.IMM, 2); def(0xA5, 'LDA', Mode.ZPG, 3);
  def(0xB5, 'LDA', Mode.ZPX, 4); def(0xAD, 'LDA', Mode.ABS, 4);
  def(0xBD, 'LDA', Mode.ABX, 4); def(0xB9, 'LDA', Mode.ABY, 4);
  def(0xA1, 'LDA', Mode.IZX, 6); def(0xB1, 'LDA', Mode.IZY, 5);
  // LDX
  def(0xA2, 'LDX', Mode.IMM, 2); def(0xA6, 'LDX', Mode.ZPG, 3);
  def(0xB6, 'LDX', Mode.ZPY, 4); def(0xAE, 'LDX', Mode.ABS, 4);
  def(0xBE, 'LDX', Mode.ABY, 4);
  // LDY
  def(0xA0, 'LDY', Mode.IMM, 2); def(0xA4, 'LDY', Mode.ZPG, 3);
  def(0xB4, 'LDY', Mode.ZPX, 4); def(0xAC, 'LDY', Mode.ABS, 4);
  def(0xBC, 'LDY', Mode.ABX, 4);
  // LSR
  def(0x4A, 'LSR', Mode.ACC, 2); def(0x46, 'LSR', Mode.ZPG, 5);
  def(0x56, 'LSR', Mode.ZPX, 6); def(0x4E, 'LSR', Mode.ABS, 6);
  def(0x5E, 'LSR', Mode.ABX, 7);
  // NOP
  def(0xEA, 'NOP', Mode.IMP, 2);
  // ORA
  def(0x09, 'ORA', Mode.IMM, 2); def(0x05, 'ORA', Mode.ZPG, 3);
  def(0x15, 'ORA', Mode.ZPX, 4); def(0x0D, 'ORA', Mode.ABS, 4);
  def(0x1D, 'ORA', Mode.ABX, 4); def(0x19, 'ORA', Mode.ABY, 4);
  def(0x01, 'ORA', Mode.IZX, 6); def(0x11, 'ORA', Mode.IZY, 5);
  // PHA/PHP/PLA/PLP
  def(0x48, 'PHA', Mode.IMP, 3); def(0x08, 'PHP', Mode.IMP, 3);
  def(0x68, 'PLA', Mode.IMP, 4); def(0x28, 'PLP', Mode.IMP, 4);
  // ROL
  def(0x2A, 'ROL', Mode.ACC, 2); def(0x26, 'ROL', Mode.ZPG, 5);
  def(0x36, 'ROL', Mode.ZPX, 6); def(0x2E, 'ROL', Mode.ABS, 6);
  def(0x3E, 'ROL', Mode.ABX, 7);
  // ROR
  def(0x6A, 'ROR', Mode.ACC, 2); def(0x66, 'ROR', Mode.ZPG, 5);
  def(0x76, 'ROR', Mode.ZPX, 6); def(0x6E, 'ROR', Mode.ABS, 6);
  def(0x7E, 'ROR', Mode.ABX, 7);
  // RTI/RTS
  def(0x40, 'RTI', Mode.IMP, 6); def(0x60, 'RTS', Mode.IMP, 6);
  // SBC
  def(0xE9, 'SBC', Mode.IMM, 2); def(0xE5, 'SBC', Mode.ZPG, 3);
  def(0xF5, 'SBC', Mode.ZPX, 4); def(0xED, 'SBC', Mode.ABS, 4);
  def(0xFD, 'SBC', Mode.ABX, 4); def(0xF9, 'SBC', Mode.ABY, 4);
  def(0xE1, 'SBC', Mode.IZX, 6); def(0xF1, 'SBC', Mode.IZY, 5);
  // SEC/SED/SEI
  def(0x38, 'SEC', Mode.IMP, 2); def(0xF8, 'SED', Mode.IMP, 2);
  def(0x78, 'SEI', Mode.IMP, 2);
  // STA
  def(0x85, 'STA', Mode.ZPG, 3); def(0x95, 'STA', Mode.ZPX, 4);
  def(0x8D, 'STA', Mode.ABS, 4); def(0x9D, 'STA', Mode.ABX, 5);
  def(0x99, 'STA', Mode.ABY, 5); def(0x81, 'STA', Mode.IZX, 6);
  def(0x91, 'STA', Mode.IZY, 6);
  // STX
  def(0x86, 'STX', Mode.ZPG, 3); def(0x96, 'STX', Mode.ZPY, 4);
  def(0x8E, 'STX', Mode.ABS, 4);
  // STY
  def(0x84, 'STY', Mode.ZPG, 3); def(0x94, 'STY', Mode.ZPX, 4);
  def(0x8C, 'STY', Mode.ABS, 4);
  // TAX/TAY/TSX/TXA/TXS/TYA
  def(0xAA, 'TAX', Mode.IMP, 2); def(0xA8, 'TAY', Mode.IMP, 2);
  def(0xBA, 'TSX', Mode.IMP, 2); def(0x8A, 'TXA', Mode.IMP, 2);
  def(0x9A, 'TXS', Mode.IMP, 2); def(0x98, 'TYA', Mode.IMP, 2);

  // Unofficial NOPs that SMB may encounter
  def(0x1A, 'NOP', Mode.IMP, 2); def(0x3A, 'NOP', Mode.IMP, 2);
  def(0x5A, 'NOP', Mode.IMP, 2); def(0x7A, 'NOP', Mode.IMP, 2);
  def(0xDA, 'NOP', Mode.IMP, 2); def(0xFA, 'NOP', Mode.IMP, 2);
  // DOP (double NOP - skip byte)
  def(0x04, 'DOP', Mode.ZPG, 3); def(0x14, 'DOP', Mode.ZPX, 4);
  def(0x34, 'DOP', Mode.ZPX, 4); def(0x44, 'DOP', Mode.ZPG, 3);
  def(0x54, 'DOP', Mode.ZPX, 4); def(0x64, 'DOP', Mode.ZPG, 3);
  def(0x74, 'DOP', Mode.ZPX, 4); def(0x80, 'DOP', Mode.IMM, 2);
  def(0x82, 'DOP', Mode.IMM, 2); def(0x89, 'DOP', Mode.IMM, 2);
  def(0xC2, 'DOP', Mode.IMM, 2); def(0xD4, 'DOP', Mode.ZPX, 4);
  def(0xE2, 'DOP', Mode.IMM, 2); def(0xF4, 'DOP', Mode.ZPX, 4);
  // TOP (triple NOP - skip word)
  def(0x0C, 'TOP', Mode.ABS, 4); def(0x1C, 'TOP', Mode.ABX, 4);
  def(0x3C, 'TOP', Mode.ABX, 4); def(0x5C, 'TOP', Mode.ABX, 4);
  def(0x7C, 'TOP', Mode.ABX, 4); def(0xDC, 'TOP', Mode.ABX, 4);
  def(0xFC, 'TOP', Mode.ABX, 4);
  // LAX (unofficial)
  def(0xA7, 'LAX', Mode.ZPG, 3); def(0xB7, 'LAX', Mode.ZPY, 4);
  def(0xAF, 'LAX', Mode.ABS, 4); def(0xBF, 'LAX', Mode.ABY, 4);
  def(0xA3, 'LAX', Mode.IZX, 6); def(0xB3, 'LAX', Mode.IZY, 5);
  // SAX (unofficial)
  def(0x87, 'SAX', Mode.ZPG, 3); def(0x97, 'SAX', Mode.ZPY, 4);
  def(0x8F, 'SAX', Mode.ABS, 4); def(0x83, 'SAX', Mode.IZX, 6);
  // SBC unofficial mirror
  def(0xEB, 'SBC', Mode.IMM, 2);
  // DCP (unofficial)
  def(0xC7, 'DCP', Mode.ZPG, 5); def(0xD7, 'DCP', Mode.ZPX, 6);
  def(0xCF, 'DCP', Mode.ABS, 6); def(0xDF, 'DCP', Mode.ABX, 7);
  def(0xDB, 'DCP', Mode.ABY, 7); def(0xC3, 'DCP', Mode.IZX, 8);
  def(0xD3, 'DCP', Mode.IZY, 8);
  // ISB/ISC (unofficial)
  def(0xE7, 'ISB', Mode.ZPG, 5); def(0xF7, 'ISB', Mode.ZPX, 6);
  def(0xEF, 'ISB', Mode.ABS, 6); def(0xFF, 'ISB', Mode.ABX, 7);
  def(0xFB, 'ISB', Mode.ABY, 7); def(0xE3, 'ISB', Mode.IZX, 8);
  def(0xF3, 'ISB', Mode.IZY, 8);
  // SLO (unofficial)
  def(0x07, 'SLO', Mode.ZPG, 5); def(0x17, 'SLO', Mode.ZPX, 6);
  def(0x0F, 'SLO', Mode.ABS, 6); def(0x1F, 'SLO', Mode.ABX, 7);
  def(0x1B, 'SLO', Mode.ABY, 7); def(0x03, 'SLO', Mode.IZX, 8);
  def(0x13, 'SLO', Mode.IZY, 8);
  // RLA (unofficial)
  def(0x27, 'RLA', Mode.ZPG, 5); def(0x37, 'RLA', Mode.ZPX, 6);
  def(0x2F, 'RLA', Mode.ABS, 6); def(0x3F, 'RLA', Mode.ABX, 7);
  def(0x3B, 'RLA', Mode.ABY, 7); def(0x23, 'RLA', Mode.IZX, 8);
  def(0x33, 'RLA', Mode.IZY, 8);
  // SRE (unofficial)
  def(0x47, 'SRE', Mode.ZPG, 5); def(0x57, 'SRE', Mode.ZPX, 6);
  def(0x4F, 'SRE', Mode.ABS, 6); def(0x5F, 'SRE', Mode.ABX, 7);
  def(0x5B, 'SRE', Mode.ABY, 7); def(0x43, 'SRE', Mode.IZX, 8);
  def(0x53, 'SRE', Mode.IZY, 8);
  // RRA (unofficial)
  def(0x67, 'RRA', Mode.ZPG, 5); def(0x77, 'RRA', Mode.ZPX, 6);
  def(0x6F, 'RRA', Mode.ABS, 6); def(0x7F, 'RRA', Mode.ABX, 7);
  def(0x7B, 'RRA', Mode.ABY, 7); def(0x63, 'RRA', Mode.IZX, 8);
  def(0x73, 'RRA', Mode.IZY, 8);

  return t;
}

const INSTRUCTION_TABLE = buildTable();

export class CPU {
  // Registers
  pc = 0;
  sp = 0xFD;
  a = 0;
  x = 0;
  y = 0;
  status = 0x24; // IRQ disabled + unused bit

  // Cycle tracking
  cycles = 0;
  stallCycles = 0;

  // Interrupt flags
  nmiPending = false;
  irqPending = false;

  private bus: CpuBus;

  constructor(bus: CpuBus) {
    this.bus = bus;
  }

  reset(): void {
    const lo = this.bus.read(0xFFFC);
    const hi = this.bus.read(0xFFFD);
    this.pc = (hi << 8) | lo;
    this.sp = 0xFD;
    this.status = 0x24;
    this.cycles = 7;
  }

  step(): number {
    if (this.stallCycles > 0) {
      this.stallCycles--;
      this.cycles++;
      return 1;
    }

    const startCycles = this.cycles;

    // Handle interrupts
    if (this.nmiPending) {
      this.nmi();
      this.nmiPending = false;
      return this.cycles - startCycles;
    }
    if (this.irqPending && !(this.status & Flag.I)) {
      this.irq();
      return this.cycles - startCycles;
    }

    const opcode = this.read(this.pc);
    const inst = INSTRUCTION_TABLE[opcode];

    if (!inst) {
      // Unknown opcode - treat as 1-byte NOP
      this.pc = (this.pc + 1) & 0xFFFF;
      this.cycles += 2;
      return 2;
    }

    this.pc = (this.pc + 1) & 0xFFFF;
    this.cycles += inst.cycles;

    let addr = 0;
    let pageCrossed = false;

    switch (inst.mode) {
      case Mode.IMP:
        break;
      case Mode.ACC:
        break;
      case Mode.IMM:
        addr = this.pc;
        this.pc = (this.pc + 1) & 0xFFFF;
        break;
      case Mode.ZPG:
        addr = this.read(this.pc);
        this.pc = (this.pc + 1) & 0xFFFF;
        break;
      case Mode.ZPX:
        addr = (this.read(this.pc) + this.x) & 0xFF;
        this.pc = (this.pc + 1) & 0xFFFF;
        break;
      case Mode.ZPY:
        addr = (this.read(this.pc) + this.y) & 0xFF;
        this.pc = (this.pc + 1) & 0xFFFF;
        break;
      case Mode.ABS: {
        const lo = this.read(this.pc);
        const hi = this.read((this.pc + 1) & 0xFFFF);
        addr = (hi << 8) | lo;
        this.pc = (this.pc + 2) & 0xFFFF;
        break;
      }
      case Mode.ABX: {
        const lo = this.read(this.pc);
        const hi = this.read((this.pc + 1) & 0xFFFF);
        const base = (hi << 8) | lo;
        addr = (base + this.x) & 0xFFFF;
        pageCrossed = (base & 0xFF00) !== (addr & 0xFF00);
        this.pc = (this.pc + 2) & 0xFFFF;
        break;
      }
      case Mode.ABY: {
        const lo = this.read(this.pc);
        const hi = this.read((this.pc + 1) & 0xFFFF);
        const base = (hi << 8) | lo;
        addr = (base + this.y) & 0xFFFF;
        pageCrossed = (base & 0xFF00) !== (addr & 0xFF00);
        this.pc = (this.pc + 2) & 0xFFFF;
        break;
      }
      case Mode.IND: {
        const ptrLo = this.read(this.pc);
        const ptrHi = this.read((this.pc + 1) & 0xFFFF);
        const ptr = (ptrHi << 8) | ptrLo;
        // 6502 page boundary bug
        const lo = this.read(ptr);
        const hiAddr = (ptr & 0xFF00) | ((ptr + 1) & 0x00FF);
        const hi = this.read(hiAddr);
        addr = (hi << 8) | lo;
        this.pc = (this.pc + 2) & 0xFFFF;
        break;
      }
      case Mode.IZX: {
        const zp = this.read(this.pc);
        const ptr = (zp + this.x) & 0xFF;
        const lo = this.read(ptr);
        const hi = this.read((ptr + 1) & 0xFF);
        addr = (hi << 8) | lo;
        this.pc = (this.pc + 1) & 0xFFFF;
        break;
      }
      case Mode.IZY: {
        const zp = this.read(this.pc);
        const lo = this.read(zp);
        const hi = this.read((zp + 1) & 0xFF);
        const base = (hi << 8) | lo;
        addr = (base + this.y) & 0xFFFF;
        pageCrossed = (base & 0xFF00) !== (addr & 0xFF00);
        this.pc = (this.pc + 1) & 0xFFFF;
        break;
      }
      case Mode.REL: {
        let offset = this.read(this.pc);
        this.pc = (this.pc + 1) & 0xFFFF;
        if (offset & 0x80) offset -= 256;
        addr = (this.pc + offset) & 0xFFFF;
        break;
      }
    }

    // Page cross penalty for read instructions
    if (pageCrossed) {
      switch (inst.op) {
        case 'ADC': case 'AND': case 'CMP': case 'EOR': case 'LDA':
        case 'LDX': case 'LDY': case 'ORA': case 'SBC':
        case 'LAX': case 'TOP': case 'NOP':
          this.cycles++;
          break;
      }
    }

    this.execute(inst.op, inst.mode, addr);

    return this.cycles - startCycles;
  }

  private execute(op: string, mode: Mode, addr: number): void {
    switch (op) {
      case 'ADC': this.adc(this.read(addr)); break;
      case 'AND': this.a &= this.read(addr); this.setNZ(this.a); break;
      case 'ASL':
        if (mode === Mode.ACC) {
          this.setFlag(Flag.C, (this.a & 0x80) !== 0);
          this.a = (this.a << 1) & 0xFF;
          this.setNZ(this.a);
        } else {
          let v = this.read(addr);
          this.setFlag(Flag.C, (v & 0x80) !== 0);
          v = (v << 1) & 0xFF;
          this.write(addr, v);
          this.setNZ(v);
        }
        break;
      case 'BCC': if (!(this.status & Flag.C)) this.branch(addr); break;
      case 'BCS': if (this.status & Flag.C) this.branch(addr); break;
      case 'BEQ': if (this.status & Flag.Z) this.branch(addr); break;
      case 'BMI': if (this.status & Flag.N) this.branch(addr); break;
      case 'BNE': if (!(this.status & Flag.Z)) this.branch(addr); break;
      case 'BPL': if (!(this.status & Flag.N)) this.branch(addr); break;
      case 'BVC': if (!(this.status & Flag.V)) this.branch(addr); break;
      case 'BVS': if (this.status & Flag.V) this.branch(addr); break;
      case 'BIT': {
        const v = this.read(addr);
        this.setFlag(Flag.Z, (this.a & v) === 0);
        this.setFlag(Flag.V, (v & 0x40) !== 0);
        this.setFlag(Flag.N, (v & 0x80) !== 0);
        break;
      }
      case 'BRK':
        this.pc = (this.pc + 1) & 0xFFFF;
        this.push16(this.pc);
        this.push(this.status | Flag.B | Flag.U);
        this.status |= Flag.I;
        this.pc = this.read16(0xFFFE);
        break;
      case 'CLC': this.status &= ~Flag.C; break;
      case 'CLD': this.status &= ~Flag.D; break;
      case 'CLI': this.status &= ~Flag.I; break;
      case 'CLV': this.status &= ~Flag.V; break;
      case 'CMP': this.compare(this.a, this.read(addr)); break;
      case 'CPX': this.compare(this.x, this.read(addr)); break;
      case 'CPY': this.compare(this.y, this.read(addr)); break;
      case 'DEC': {
        const v = (this.read(addr) - 1) & 0xFF;
        this.write(addr, v);
        this.setNZ(v);
        break;
      }
      case 'DEX': this.x = (this.x - 1) & 0xFF; this.setNZ(this.x); break;
      case 'DEY': this.y = (this.y - 1) & 0xFF; this.setNZ(this.y); break;
      case 'EOR': this.a ^= this.read(addr); this.setNZ(this.a); break;
      case 'INC': {
        const v = (this.read(addr) + 1) & 0xFF;
        this.write(addr, v);
        this.setNZ(v);
        break;
      }
      case 'INX': this.x = (this.x + 1) & 0xFF; this.setNZ(this.x); break;
      case 'INY': this.y = (this.y + 1) & 0xFF; this.setNZ(this.y); break;
      case 'JMP': this.pc = addr; break;
      case 'JSR':
        this.push16((this.pc - 1) & 0xFFFF);
        this.pc = addr;
        break;
      case 'LDA': this.a = this.read(addr); this.setNZ(this.a); break;
      case 'LDX': this.x = this.read(addr); this.setNZ(this.x); break;
      case 'LDY': this.y = this.read(addr); this.setNZ(this.y); break;
      case 'LSR':
        if (mode === Mode.ACC) {
          this.setFlag(Flag.C, (this.a & 1) !== 0);
          this.a >>= 1;
          this.setNZ(this.a);
        } else {
          let v = this.read(addr);
          this.setFlag(Flag.C, (v & 1) !== 0);
          v >>= 1;
          this.write(addr, v);
          this.setNZ(v);
        }
        break;
      case 'NOP': break;
      case 'DOP': break; // double NOP - address already consumed
      case 'TOP': break; // triple NOP - address already consumed
      case 'ORA': this.a |= this.read(addr); this.setNZ(this.a); break;
      case 'PHA': this.push(this.a); break;
      case 'PHP': this.push(this.status | Flag.B | Flag.U); break;
      case 'PLA':
        this.a = this.pull();
        this.setNZ(this.a);
        break;
      case 'PLP':
        this.status = (this.pull() & ~Flag.B) | Flag.U;
        break;
      case 'ROL':
        if (mode === Mode.ACC) {
          const c = this.status & Flag.C;
          this.setFlag(Flag.C, (this.a & 0x80) !== 0);
          this.a = ((this.a << 1) | c) & 0xFF;
          this.setNZ(this.a);
        } else {
          let v = this.read(addr);
          const c = this.status & Flag.C;
          this.setFlag(Flag.C, (v & 0x80) !== 0);
          v = ((v << 1) | c) & 0xFF;
          this.write(addr, v);
          this.setNZ(v);
        }
        break;
      case 'ROR':
        if (mode === Mode.ACC) {
          const c = this.status & Flag.C;
          this.setFlag(Flag.C, (this.a & 1) !== 0);
          this.a = (this.a >> 1) | (c << 7);
          this.setNZ(this.a);
        } else {
          let v = this.read(addr);
          const c = this.status & Flag.C;
          this.setFlag(Flag.C, (v & 1) !== 0);
          v = (v >> 1) | (c << 7);
          this.write(addr, v);
          this.setNZ(v);
        }
        break;
      case 'RTI':
        this.status = (this.pull() & ~Flag.B) | Flag.U;
        this.pc = this.pull16();
        break;
      case 'RTS':
        this.pc = (this.pull16() + 1) & 0xFFFF;
        break;
      case 'SBC': this.sbc(this.read(addr)); break;
      case 'SEC': this.status |= Flag.C; break;
      case 'SED': this.status |= Flag.D; break;
      case 'SEI': this.status |= Flag.I; break;
      case 'STA': this.write(addr, this.a); break;
      case 'STX': this.write(addr, this.x); break;
      case 'STY': this.write(addr, this.y); break;
      case 'TAX': this.x = this.a; this.setNZ(this.x); break;
      case 'TAY': this.y = this.a; this.setNZ(this.y); break;
      case 'TSX': this.x = this.sp; this.setNZ(this.x); break;
      case 'TXA': this.a = this.x; this.setNZ(this.a); break;
      case 'TXS': this.sp = this.x; break;
      case 'TYA': this.a = this.y; this.setNZ(this.a); break;
      // Unofficial opcodes
      case 'LAX': {
        const v = this.read(addr);
        this.a = v; this.x = v;
        this.setNZ(v);
        break;
      }
      case 'SAX': this.write(addr, this.a & this.x); break;
      case 'DCP': {
        let v = (this.read(addr) - 1) & 0xFF;
        this.write(addr, v);
        this.compare(this.a, v);
        break;
      }
      case 'ISB': {
        const v = (this.read(addr) + 1) & 0xFF;
        this.write(addr, v);
        this.sbc(v);
        break;
      }
      case 'SLO': {
        let v = this.read(addr);
        this.setFlag(Flag.C, (v & 0x80) !== 0);
        v = (v << 1) & 0xFF;
        this.write(addr, v);
        this.a |= v;
        this.setNZ(this.a);
        break;
      }
      case 'RLA': {
        let v = this.read(addr);
        const c = this.status & Flag.C;
        this.setFlag(Flag.C, (v & 0x80) !== 0);
        v = ((v << 1) | c) & 0xFF;
        this.write(addr, v);
        this.a &= v;
        this.setNZ(this.a);
        break;
      }
      case 'SRE': {
        let v = this.read(addr);
        this.setFlag(Flag.C, (v & 1) !== 0);
        v >>= 1;
        this.write(addr, v);
        this.a ^= v;
        this.setNZ(this.a);
        break;
      }
      case 'RRA': {
        let v = this.read(addr);
        const c = this.status & Flag.C;
        this.setFlag(Flag.C, (v & 1) !== 0);
        v = (v >> 1) | (c << 7);
        this.write(addr, v);
        this.adc(v);
        break;
      }
    }
  }

  private adc(value: number): void {
    const carry = this.status & Flag.C;
    const sum = this.a + value + carry;
    this.setFlag(Flag.C, sum > 0xFF);
    this.setFlag(Flag.V, ((this.a ^ sum) & (value ^ sum) & 0x80) !== 0);
    this.a = sum & 0xFF;
    this.setNZ(this.a);
  }

  private sbc(value: number): void {
    this.adc(value ^ 0xFF);
  }

  private compare(reg: number, value: number): void {
    const diff = reg - value;
    this.setFlag(Flag.C, diff >= 0);
    this.setNZ(diff & 0xFF);
  }

  private branch(addr: number): void {
    this.cycles++;
    if ((this.pc & 0xFF00) !== (addr & 0xFF00)) {
      this.cycles++;
    }
    this.pc = addr;
  }

  private setNZ(value: number): void {
    this.setFlag(Flag.Z, value === 0);
    this.setFlag(Flag.N, (value & 0x80) !== 0);
  }

  private setFlag(flag: number, set: boolean): void {
    if (set) {
      this.status |= flag;
    } else {
      this.status &= ~flag;
    }
  }

  private push(value: number): void {
    this.bus.write(0x0100 | this.sp, value);
    this.sp = (this.sp - 1) & 0xFF;
  }

  private pull(): number {
    this.sp = (this.sp + 1) & 0xFF;
    return this.bus.read(0x0100 | this.sp);
  }

  private push16(value: number): void {
    this.push((value >> 8) & 0xFF);
    this.push(value & 0xFF);
  }

  private pull16(): number {
    const lo = this.pull();
    const hi = this.pull();
    return (hi << 8) | lo;
  }

  private read(addr: number): number {
    return this.bus.read(addr);
  }

  private read16(addr: number): number {
    const lo = this.bus.read(addr);
    const hi = this.bus.read((addr + 1) & 0xFFFF);
    return (hi << 8) | lo;
  }

  private write(addr: number, value: number): void {
    this.bus.write(addr, value);
  }

  private nmi(): void {
    this.push16(this.pc);
    this.push((this.status | Flag.U) & ~Flag.B);
    this.status |= Flag.I;
    this.pc = this.read16(0xFFFA);
    this.cycles += 7;
  }

  private irq(): void {
    this.push16(this.pc);
    this.push((this.status | Flag.U) & ~Flag.B);
    this.status |= Flag.I;
    this.pc = this.read16(0xFFFE);
    this.cycles += 7;
  }
}
