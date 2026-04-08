import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
    constructor(private profileService: ProfileService) { }

    @Get('me')
    async me(@Req() req: { user?: { id: string; email: string } }) {
        if (!req.user?.id) return { user: null };
        const result = await this.profileService.getMe(req.user.id);
        return result ?? { user: null };
    }

    @Patch('me')
    async updateMe(
        @Req() req: { user?: { id: string; email: string } },
        @Body()
        body: {
            displayName?: string;
            avatarUrl?: string;
            preferredSports?: string[];
            onlyPreferred?: boolean;
        },
    ) {
        if (!req.user?.id) return { user: null };
        const result = await this.profileService.updateMe(req.user.id, body || {});
        return result ?? { user: null };
    }

    @Get('following')
    async following(@Req() req: { user?: { id: string; email: string } }) {
        if (!req.user?.id) return { teams: [] };
        return this.profileService.listFollowing(req.user.id);
    }

    @Post('following')
    async follow(
        @Req() req: { user?: { id: string; email: string } },
        @Body() body: { teamName?: string },
    ) {
        if (!req.user?.id) return { team: null };
        return this.profileService.followTeam(req.user.id, body?.teamName ?? '');
    }

    @Delete('following/:id')
    async unfollow(
        @Req() req: { user?: { id: string; email: string } },
        @Param('id') id: string,
    ) {
        if (!req.user?.id) return { ok: true };
        return this.profileService.unfollowTeam(req.user.id, id);
    }

    @Get('team-suggestions')
    async teamSuggestions(
        @Req() req: { user?: { id: string; email: string } },
        @Query('q') q?: string,
    ) {
        if (!req.user?.id) return { options: [] };
        return this.profileService.suggestTeams(req.user.id, q ?? '');
    }

    @Get('upcoming')
    async upcoming(
        @Req() req: { user?: { id: string; email: string } },
        @Query('days') days?: string,
    ) {
        if (!req.user?.id) return { matches: [] };
        const parsed = Number.parseInt(days || '7', 10);
        const windowDays = Number.isFinite(parsed) ? parsed : 7;
        return this.profileService.getUpcomingForFollowedTeams(req.user.id, windowDays);
    }
}

