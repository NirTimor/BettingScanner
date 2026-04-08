import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AuthService } from './auth.service';

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
        const header = request.headers?.authorization || '';
        const token = this.extractToken(header);
        if (!token) {
            throw new UnauthorizedException('Missing token');
        }

        const user = await this.authService.validateSession(token);
        if (!user) {
            throw new UnauthorizedException('Invalid token');
        }

        request.user = { id: user.id, email: user.email };
        return true;
    }

    private extractToken(header: string) {
        if (!header) return '';
        const [type, value] = header.split(' ');
        if (type !== 'Bearer' || !value) return '';
        return value.trim();
    }
}
