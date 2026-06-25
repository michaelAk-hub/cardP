import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { Prisma, Student } from '@prisma/client';
import { Locale } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HashingService } from '../auth/hashing.service';
import { TokenService } from '../auth/token.service';
import { MailService } from '../mail/mail.service';
import { TokenPair } from '../auth/auth.types';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterStudentDto,
  ResetPasswordDto,
} from './dto';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

// Public projection of a student — never leaks password_hash.
export type StudentView = Omit<Student, 'passwordHash'>;

function toStudentView(student: Student): StudentView {
  const { passwordHash: _omit, ...view } = student;
  return view;
}

@Injectable()
export class StudentAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async register(
    dto: RegisterStudentDto,
  ): Promise<{ student: StudentView; tokens: TokenPair }> {
    const email = dto.email.toLowerCase().trim();

    const university = await this.prisma.university.findUnique({
      where: { id: dto.universityId },
    });
    if (!university || !university.active) {
      throw new BadRequestException('Invalid university');
    }

    const passwordHash = await this.hashing.hashPassword(dto.password);

    let student: Student;
    try {
      student = await this.prisma.student.create({
        data: {
          name: dto.name.trim(),
          surname: dto.surname.trim(),
          email,
          phone: dto.phone,
          universityId: dto.universityId,
          passwordHash,
          marketingConsent: dto.marketingConsent ?? false,
          // account_status defaults to pending; all verify flags default false.
        },
      });
    } catch (err) {
      // Unique constraint (email / phone) -> 409 with a clear field hint.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const target = (err.meta?.target as string[] | undefined)?.join(', ');
        throw new ConflictException(
          `An account with this ${target ?? 'email or phone'} already exists`,
        );
      }
      throw err;
    }

    const tokens = await this.tokens.issueTokens({
      id: student.id,
      type: 'student',
    });
    return { student: toStudentView(student), tokens };
  }

  async login(dto: LoginDto): Promise<{ student: StudentView; tokens: TokenPair }> {
    const email = dto.email.toLowerCase().trim();
    const student = await this.prisma.student.findUnique({ where: { email } });

    // Generic error either way — don't reveal whether the email exists.
    const ok =
      student &&
      (await this.hashing.verifyPassword(student.passwordHash, dto.password));
    if (!student || !ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.tokens.issueTokens({
      id: student.id,
      type: 'student',
    });
    return { student: toStudentView(student), tokens };
  }

  refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  // Always resolves the same way to avoid account enumeration.
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const email = dto.email.toLowerCase().trim();
    const student = await this.prisma.student.findUnique({ where: { email } });
    if (!student) {
      return;
    }

    const rawToken = randomBytes(32).toString('hex');
    await this.prisma.verificationToken.create({
      data: {
        studentId: student.id,
        type: 'password_reset',
        token: this.hashing.hashToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const base = this.config.get<string>('API_PUBLIC_URL', '');
    const link = `${base}/reset-password?token=${rawToken}`;
    const locale = this.config.get<Locale>('DEFAULT_LOCALE', 'el');
    await this.mail.sendPasswordReset(email, link, locale);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = this.hashing.hashToken(dto.token);
    const record = await this.prisma.verificationToken.findFirst({
      where: {
        token: tokenHash,
        type: 'password_reset',
        used: false,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await this.hashing.hashPassword(dto.password);
    await this.prisma.$transaction([
      this.prisma.student.update({
        where: { id: record.studentId },
        data: { passwordHash },
      }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { used: true },
      }),
    ]);

    // Invalidate existing sessions after a password change.
    await this.tokens.revokeAll('student', record.studentId);
  }

  async me(studentId: string): Promise<StudentView> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return toStudentView(student);
  }
}
