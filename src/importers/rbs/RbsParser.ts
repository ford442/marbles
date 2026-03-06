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

    private readString(len: number): string {
        const bytes = this.data.slice(this.pos, this.pos + len);
        this.pos += len;
        return bytes.toString('ascii').replace(/\0+$/, '');
    }

    private readHeader(): { version: number; type: string; length: number } {
        const version = this.readUInt8();
        const type = String.fromCharCode(this.readUInt8());
        const length = this.readUInt16();
        return { version, type, length };
    }

    parse(): RbsSong {
        const header = this.readHeader();
        const song: RbsSong = {
            title: `RBS ${header.type}${header.version}`,
            tempo: 120,
            tracks: [],
        };

        const trackCount = this.readUInt8();
        for (let t = 0; t < trackCount; t++) {
            const instCode = this.readUInt8();
            let instrument = 'unknown';
            switch (instCode) {
                case 0:
                    instrument = 'TB-303 A';
                    break;
                case 1:
                    instrument = 'TB-303 B';
                    break;
                case 2:
                    instrument = '808';
                    break;
                case 3:
                    instrument = '909';
                    break;
            }

            const patternCount = this.readUInt8();
            const patterns: RbsPattern[] = [];

            for (let p = 0; p < patternCount; p++) {
                const stepCount = this.readUInt8(); // 16 or 32
                const steps: number[] = [];
                for (let s = 0; s < stepCount; s++) {
                    steps.push(this.readUInt8());
                }

                const slideCount = this.readUInt8();
                const slides: Slide[] = [];
                for (let i = 0; i < slideCount; i++) {
                    slides.push({
                        start: this.readUInt8(),
                        end: this.readUInt8(),
                        from: this.readUInt8(),
                        to: this.readUInt8(),
                    });
                }

                const accentCount = this.readUInt8();
                const accents: Accent[] = [];
                for (let i = 0; i < accentCount; i++) {
                    accents.push({
                        step: this.readUInt8(),
                        value: this.readUInt8(),
                    });
                }

                const automationCount = this.readUInt8();
                const automation: AutomationLane[] = [];
                for (let i = 0; i < automationCount; i++) {
                    const paramLen = this.readUInt8();
                    const param = this.readString(paramLen);
                    const pointCount = this.readUInt8();
                    const points: AutomationPoint[] = [];
                    for (let k = 0; k < pointCount; k++) {
                        points.push({
                            time: this.readUInt16(),
                            value: this.readUInt8(),
                        });
                    }
                    automation.push({ parameter: param, points });
                }

                patterns.push({
                    steps,
                    slides: slides.length ? slides : undefined,
                    accents: accents.length ? accents : undefined,
                    automation: automation.length ? automation : undefined,
                });
            }
            song.tracks.push({ instrument, patterns });
        }

        return song;
    }

    static fromFile(path: string): RbsSong {
        const buf = fs.readFileSync(path);
        const parser = new RbsParser(buf);
        return parser.parse();
    }

    // convenience for browser usage when given Uint8Array
    static fromBuffer(buf: Uint8Array): RbsSong {
        const buffer = Buffer.from(buf);
        const parser = new RbsParser(buffer);
        return parser.parse();
    }
}