import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AuthService } from './auth.service';
import { ADMIN_ONLY_KEY } from './admin.decorator';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private reflector: Reflector, private authService: AuthService) { }

    async canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) return true;

        const request = context.switchToHttp().getRequest();
        const isAdminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isAdminOnly && this.hasValidCronSecret(request)) {
            request.user = { id: 'cron', email: 'cron@system', role: 'ADMIN' };
            return true;
        }

        const header = request.headers?.authorization || '';
        const token = this.extractToken(header);
        if (!token) {
            throw new UnauthorizedException('Missing token');
        }

        const user = await this.authService.validateSession(token);
        if (!user) {
            throw new UnauthorizedException('Invalid token');
        }

        request.user = {
            id: user.id,
            email: user.email,
            role: this.authService.canAccessAdmin(user) ? 'ADMIN' : 'USER',
        };
        if (isAdminOnly && !this.authService.canAccessAdmin(user)) {
            throw new ForbiddenException('Admin access required');
        }

        return true;
    }

    private hasValidCronSecret(request: { headers?: Record<string, string | string[] | undefined> }) {
        const expected = process.env.CRON_SECRET?.trim();
        if (!expected) return false;

        const headerValue = request.headers?.['x-cron-secret'];
        const fromHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        const fromBearer = this.extractToken(String(request.headers?.authorization || ''));
        const provided = (fromHeader || fromBearer || '').trim();
        if (!provided) return false;

        const expectedBuf = Buffer.from(expected);
        const providedBuf = Buffer.from(provided);
        if (expectedBuf.length !== providedBuf.length) return false;
        return timingSafeEqual(expectedBuf, providedBuf);
    }

    private extractToken(header: string) {
        if (!header) return '';
        const [type, value] = header.split(' ');
        if (type !== 'Bearer' || !value) return '';
        return value.trim();
    }
}
