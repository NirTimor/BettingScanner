import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const PASSWORD_ITERATIONS = 100000;
const PASSWORD_KEYLEN = 64;
const PASSWORD_DIGEST = 'sha512';
const SESSION_DAYS = 30;
const RESET_TOKEN_MINUTES = 30;
const ADMIN_ROLE = 'ADMIN';
const USER_ROLE = 'USER';

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService) { }

    async register(email: string, password: string) {
        const normalizedEmail = this.normalizeEmail(email);
        if (!normalizedEmail || !password || password.length < 6) {
            throw new BadRequestException('Invalid email or password');
        }

        const existing = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (existing) {
            throw new BadRequestException('Email already registered');
        }

        const salt = randomBytes(16).toString('base64');
        const hash = this.hashPassword(password, salt);

        const user = await this.prisma.user.create({
            data: {
                email: normalizedEmail,
                passwordHash: hash,
                passwordSalt: salt,
                role: this.getRoleForEmail(normalizedEmail),
            },
        });

        const session = await this.createSession(user.id);

        return {
            token: session.token,
            user: { id: user.id, email: user.email, role: this.getEffectiveRole(user) },
        };
    }

    async login(email: string, password: string) {
        const normalizedEmail = this.normalizeEmail(email);
        if (!normalizedEmail || !password) {
            throw new BadRequestException('Invalid email or password');
        }

        const user = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const hash = this.hashPassword(password, user.passwordSalt);
        const matches = timingSafeEqual(Buffer.from(hash), Buffer.from(user.passwordHash));
        if (!matches) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const session = await this.createSession(user.id);

        return {
            token: session.token,
            user: { id: user.id, email: user.email, role: this.getEffectiveRole(user) },
        };
    }

    async validateSession(token: string) {
        if (!token) return null;

        const session = await this.prisma.session.findUnique({
            where: { token },
            include: { user: true },
        });
        if (!session) return null;

        if (session.expiresAt.getTime() < Date.now()) {
            await this.prisma.session.delete({ where: { id: session.id } });
            return null;
        }

        return {
            ...session.user,
            role: this.getEffectiveRole(session.user),
        };
    }

    async requestPasswordReset(email: string) {
        const normalizedEmail = this.normalizeEmail(email);
        if (!normalizedEmail) {
            return { ok: true };
        }

        const user = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            return { ok: true };
        }

        const token = randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);

        await this.prisma.passwordReset.create({
            data: { token, userId: user.id, expiresAt },
        });

        return { ok: true };
    }

    async resetPassword(token: string, newPassword: string) {
        if (!token || !newPassword || newPassword.length < 6) {
            throw new BadRequestException('Invalid token or password');
        }

        const reset = await this.prisma.passwordReset.findUnique({
            where: { token },
        });
        if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
            throw new BadRequestException('Invalid or expired token');
        }

        const salt = randomBytes(16).toString('base64');
        const hash = this.hashPassword(newPassword, salt);

        await this.prisma.user.update({
            where: { id: reset.userId },
            data: {
                passwordHash: hash,
                passwordSalt: salt,
            },
        });

        await this.prisma.passwordReset.update({
            where: { id: reset.id },
            data: { usedAt: new Date() },
        });

        await this.prisma.session.deleteMany({
            where: { userId: reset.userId },
        });

        const session = await this.createSession(reset.userId);

        return {
            token: session.token,
        };
    }

    private async createSession(userId: string) {
        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

        return this.prisma.session.create({
            data: { token, userId, expiresAt },
        });
    }

    private hashPassword(password: string, salt: string) {
        return pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEYLEN, PASSWORD_DIGEST).toString('base64');
    }

    private normalizeEmail(email: string) {
        if (!email) return '';
        return email.trim().toLowerCase();
    }

    private getRoleForEmail(email: string) {
        const adminEmails = (process.env.ADMIN_EMAILS || '')
            .split(',')
            .map(value => this.normalizeEmail(value))
            .filter(Boolean);

        return adminEmails.includes(email) ? ADMIN_ROLE : USER_ROLE;
    }

    canAccessAdmin(user: { email: string; role?: string | null }) {
        if (this.getEffectiveRole(user) === ADMIN_ROLE) {
            return true;
        }

        return process.env.NODE_ENV !== 'production' && !(process.env.ADMIN_EMAILS || '').trim();
    }

    private getEffectiveRole(user: { email: string; role?: string | null }) {
        if (user.role === ADMIN_ROLE) return ADMIN_ROLE;
        return this.getRoleForEmail(user.email);
    }
}
