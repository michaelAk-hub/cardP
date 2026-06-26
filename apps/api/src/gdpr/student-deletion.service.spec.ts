import { NotFoundException } from '@nestjs/common';
import { StudentDeletionService } from './student-deletion.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

function build(student: any) {
  const prisma = {
    student: {
      findUnique: jest.fn(async () => student),
      delete: jest.fn(async () => student),
    },
    refreshToken: { deleteMany: jest.fn(async () => ({ count: 1 })) },
  } as unknown as PrismaService;
  const storage = { delete: jest.fn(async () => undefined) } as unknown as StorageService;
  return { svc: new StudentDeletionService(prisma, storage), prisma, storage };
}

describe('StudentDeletionService (right-to-erasure)', () => {
  it('deletes ID photo objects, refresh tokens, and the student', async () => {
    const { svc, prisma, storage } = build({
      id: 's1',
      idDocument: { frontKey: 'f', backKey: 'b' },
    });

    await svc.delete('s1');

    expect(storage.delete).toHaveBeenCalledWith('f');
    expect(storage.delete).toHaveBeenCalledWith('b');
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { principalType: 'student', principalId: 's1' },
    });
    expect(prisma.student.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });

  it('still deletes the student when no ID document exists', async () => {
    const { svc, prisma, storage } = build({ id: 's2', idDocument: null });
    await svc.delete('s2');
    expect(storage.delete).not.toHaveBeenCalled();
    expect(prisma.student.delete).toHaveBeenCalledWith({ where: { id: 's2' } });
  });

  it('throws when the student does not exist', async () => {
    const { svc } = build(null);
    await expect(svc.delete('missing')).rejects.toThrow(NotFoundException);
  });
});
