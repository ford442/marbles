import { RbsSong } from './types';
import fs from 'fs';

export class RbsParser {
  private data: Buffer;
  private pos: number = 0;

  constructor(buffer: Buffer) {
    this.data = buffer;
  }

  private readUInt8(): number {
    return this.data.readUInt8(this.pos++);
  }

  private readUInt16(): number {
    const val = this.data.readUInt16LE(this.pos);
    this.pos += 2;
    return val;
  }

  private readHeader(): { version: number; type: string; length: number } {
    const version = this.readUInt8();
    const type = String.fromCharCode(this.readUInt8());
    const length = this.readUInt16();
    return { version, type, length };
  }

  parse(): RbsSong {
    const header = this.readHeader();
    // stub implementation; real format parsing would go here
    const song: RbsSong = { title: '', tempo: 120, tracks: [] };
    // TODO: iterate over tracks and patterns, extract slides/accents/automation
    return song;
  }

  static fromFile(path: string): RbsSong {
    const buf = fs.readFileSync(path);
    const parser = new RbsParser(buf);
    return parser.parse();
  }
}