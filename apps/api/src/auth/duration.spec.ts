import { durationToMs } from './duration';

describe('durationToMs', () => {
  it('parses units', () => {
    expect(durationToMs('45s')).toBe(45_000);
    expect(durationToMs('15m')).toBe(900_000);
    expect(durationToMs('12h')).toBe(43_200_000);
    expect(durationToMs('30d')).toBe(2_592_000_000);
  });

  it('treats a bare number as seconds', () => {
    expect(durationToMs('3600')).toBe(3_600_000);
  });

  it('throws on garbage', () => {
    expect(() => durationToMs('soon')).toThrow();
    expect(() => durationToMs('10x')).toThrow();
  });
});
