import { RbsParser } from '../importers/rbs/RbsParser';
import { RbsSong } from '../importers/rbs/types';

describe('RbsParser', () => {
  it('parses simple header and tracks', () => {
    // create a fake buffer: version=1, type='A', length=0, trackCount=1, inst=0, patterns=0
    const buf = Buffer.from([1, 65, 0, 1, 0, 0, 0]);
    const song: RbsSong = RbsParser.fromBuffer(buf);
    expect(song.title).toContain('A1');
    expect(song.tracks.length).toBe(1);
  });
});