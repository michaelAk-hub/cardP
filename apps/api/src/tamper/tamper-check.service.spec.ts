import { TamperStatus } from '@blue-card/shared';
import { TamperCheckService } from './tamper-check.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { TamperScorer } from './tamper-scorer';

function build(doc: any = { id: 'doc1', frontKey: 'f', backKey: 'b' }) {
  const update = jest.fn(async () => doc);
  const prisma = {
    idDocument: { findUnique: jest.fn(async () => doc), update },
  } as unknown as PrismaService;
  const storage = {
    read: jest.fn(async () => ({ buffer: Buffer.from('x'), contentType: 'image/jpeg' })),
  } as unknown as StorageService;
  const scorer = {
    score: jest.fn(),
  } as unknown as TamperScorer;
  return { svc: new TamperCheckService(prisma, storage, scorer), prisma, storage, scorer, update };
}

describe('TamperCheckService', () => {
  it('persists the worst (highest) score across both photos', async () => {
    const { svc, scorer, update } = build();
    (scorer.score as jest.Mock)
      .mockResolvedValueOnce({ score: 0.2, status: TamperStatus.Clean, signals: {} })
      .mockResolvedValueOnce({ score: 0.8, status: TamperStatus.Flagged, signals: {} });

    await svc.run('doc1');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'doc1' },
      data: { tamperScore: 0.8, tamperStatus: TamperStatus.Flagged },
    });
  });

  it('only updates tamper fields — never id_verified / account_status', async () => {
    const { svc, scorer, update } = build();
    (scorer.score as jest.Mock).mockResolvedValue({
      score: 0.1,
      status: TamperStatus.Clean,
      signals: {},
    });
    await svc.run('doc1');
    const data = (update as jest.Mock).mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual(['tamperScore', 'tamperStatus']);
  });

  it('no-ops when the document is missing', async () => {
    const { svc, prisma, update } = build();
    (prisma.idDocument.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await svc.run('missing');
    expect(update).not.toHaveBeenCalled();
  });

  it('swallows scorer/storage failures (does not block verification)', async () => {
    const { svc, scorer, update } = build();
    (scorer.score as jest.Mock).mockRejectedValue(new Error('boom'));
    await expect(svc.run('doc1')).resolves.toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });
});
