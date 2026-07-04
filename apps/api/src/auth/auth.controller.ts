import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Public()
    @Post('register')
    async register(@Body() body: { email?: string; password?: string }) {
        return this.authService.register(body.email ?? '', body.password ?? '');
    }

    @Public()
    @Post('login')
    async login(@Body() body: { email?: string; password?: string }) {
        return this.authService.login(body.email ?? '', body.password ?? '');
    }

    @Public()
    @Post('forgot')
    async forgot(@Body() body: { email?: string }) {
        return this.authService.requestPasswordReset(body.email ?? '');
    }

    @Public()
    @Post('reset')
    async reset(@Body() body: { token?: string; password?: string }) {
        return this.authService.resetPassword(body.token ?? '', body.password ?? '');
    }

    @Get('me')
    async me(@Req() req: { user?: { id: string; email: string; role: string } }) {
        return { user: req.user ?? null };
    }
}
