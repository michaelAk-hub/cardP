import { TamperStatus } from '@blue-card/shared';
import exifr from 'exifr';
import { HeuristicTamperScorer } from './heuristic-scorer';

jest.mock('exifr', () => ({ __esModule: true, default: { parse: jest.fn() } }));
const mockParse = exifr.parse as jest.Mock;

const scorer = new HeuristicTamperScorer({ suspect: 0.34, flagged: 0.67 });
const img = (contentType: string) => ({ buffer: Buffer.from('x'), contentType });

describe('HeuristicTamperScorer', () => {
  afterEach(() => mockParse.mockReset());

  it('scores a genuine camera JPEG as clean', async () => {
    mockParse.mockResolvedValue({ Make: 'Apple', Model: 'iPhone 12' });
    const r = await scorer.score(img('image/jpeg'));
    expect(r.status).toBe(TamperStatus.Clean);
    expect(r.score).toBeLessThan(0.34);
  });

  it('flags an image edited in Photoshop', async () => {
    mockParse.mockResolvedValue({ Software: 'Adobe Photoshop 24.0 (Windows)' });
    const r = await scorer.score(img('image/jpeg'));
    expect(r.status).toBe(TamperStatus.Flagged);
    expect(r.signals.editorSoftware).toBe(true);
    expect(r.signals.editor).toBe('photoshop');
  });

  it('marks a PNG with no metadata as suspect', async () => {
    mockParse.mockResolvedValue(undefined);
    const r = await scorer.score(img('image/png'));
    expect(r.status).toBe(TamperStatus.Suspect);
    expect(r.signals.nonJpeg).toBe(true);
    expect(r.signals.noExif).toBe(true);
  });

  it('detects a capture/modify date mismatch signal', async () => {
    mockParse.mockResolvedValue({
      Make: 'Canon',
      Model: 'EOS',
      DateTimeOriginal: new Date(0),
      ModifyDate: new Date(3_600_000),
    });
    const r = await scorer.score(img('image/jpeg'));
    expect(r.signals.dateMismatch).toBe(true);
  });

  it('never returns a score above 1', async () => {
    mockParse.mockResolvedValue({ Software: 'GIMP' });
    const r = await scorer.score(img('image/png'));
    expect(r.score).toBeLessThanOrEqual(1);
  });
});
