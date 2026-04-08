import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfileService {
    constructor(private prisma: PrismaService) { }

    async getMe(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                profile: true,
                preferences: true,
            },
        });
        if (!user) return null;

        const preferredSports = this.safeParseJsonArray(user.preferences?.preferredSportsJson);

        return {
            user: { id: user.id, email: user.email },
            profile: {
                displayName: user.profile?.displayName ?? '',
                avatarUrl: user.profile?.avatarUrl ?? '',
            },
            preferences: {
                preferredSports,
                onlyPreferred: user.preferences?.onlyPreferred ?? false,
            },
        };
    }

    async updateMe(
        userId: string,
        input: {
            displayName?: string;
            avatarUrl?: string;
            preferredSports?: string[];
            onlyPreferred?: boolean;
        },
    ) {
        const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : undefined;
        const avatarUrl = typeof input.avatarUrl === 'string' ? input.avatarUrl.trim() : undefined;

        if (displayName !== undefined && displayName.length > 60) {
            throw new BadRequestException('Display name too long');
        }
        if (avatarUrl !== undefined && avatarUrl.length > 2_000_000) {
            // large data: URLs can be big; still cap to avoid accidental huge payloads
            throw new BadRequestException('Avatar too large');
        }

        const preferredSports =
            Array.isArray(input.preferredSports)
                ? input.preferredSports.filter((x): x is string => typeof x === 'string').slice(0, 200)
                : undefined;
        const onlyPreferred = typeof input.onlyPreferred === 'boolean' ? input.onlyPreferred : undefined;

        await this.prisma.$transaction(async (tx) => {
            if (displayName !== undefined || avatarUrl !== undefined) {
                await tx.userProfile.upsert({
                    where: { userId },
                    create: {
                        userId,
                        displayName: displayName ?? null,
                        avatarUrl: avatarUrl ?? null,
                    },
                    update: {
                        ...(displayName !== undefined ? { displayName: displayName ?? null } : {}),
                        ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl ?? null } : {}),
                    },
                });
            }

            if (preferredSports !== undefined || onlyPreferred !== undefined) {
                await tx.userPreference.upsert({
                    where: { userId },
                    create: {
                        userId,
                        preferredSportsJson: JSON.stringify(preferredSports ?? []),
                        onlyPreferred: onlyPreferred ?? false,
                    },
                    update: {
                        ...(preferredSports !== undefined ? { preferredSportsJson: JSON.stringify(preferredSports) } : {}),
                        ...(onlyPreferred !== undefined ? { onlyPreferred } : {}),
                    },
                });
            }
        });

        return this.getMe(userId);
    }

    async listFollowing(userId: string) {
        const items = await this.prisma.followedTeam.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, teamName: true, normalizedName: true, createdAt: true },
        });
        return { teams: items };
    }

    async followTeam(userId: string, teamName: string) {
        const trimmed = (teamName || '').trim();
        if (!trimmed) throw new BadRequestException('Missing teamName');
        if (trimmed.length > 80) throw new BadRequestException('Team name too long');

        const normalizedName = this.normalizeTeamName(trimmed);
        if (!normalizedName) throw new BadRequestException('Invalid teamName');

        try {
            const created = await this.prisma.followedTeam.create({
                data: {
                    userId,
                    teamName: trimmed,
                    normalizedName,
                },
                select: { id: true, teamName: true, normalizedName: true, createdAt: true },
            });
            return { team: created };
        } catch {
            // Unique constraint: already followed
            const existing = await this.prisma.followedTeam.findFirst({
                where: { userId, normalizedName },
                select: { id: true, teamName: true, normalizedName: true, createdAt: true },
            });
            return { team: existing };
        }
    }

    async unfollowTeam(userId: string, followedTeamId: string) {
        const existing = await this.prisma.followedTeam.findFirst({
            where: { id: followedTeamId, userId },
            select: { id: true },
        });
        if (!existing) return { ok: true };
        await this.prisma.followedTeam.delete({ where: { id: followedTeamId } });
        return { ok: true };
    }

    async suggestTeams(userId: string, query: string) {
        const q = (query || '').trim();
        if (q.length < 2) return { options: [] as Array<{ name: string }> };
        if (q.length > 40) return { options: [] as Array<{ name: string }> };

        const normalizedQ = this.normalizeTeamName(q);
        if (!normalizedQ) return { options: [] as Array<{ name: string }> };

        const now = new Date();
        const pastWindow = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
        const futureWindow = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

        // Build pool from both recent history and upcoming fixtures.
        // This avoids "empty suggestions" when upcoming DB is sparse.
        const recs = await this.prisma.recommendation.findMany({
            where: {
                commenceTime: { gte: pastWindow, lte: futureWindow },
            },
            select: { homeTeam: true, awayTeam: true },
            orderBy: { commenceTime: 'desc' },
            take: 5000,
        });

        const pool = new Map<string, string>();
        for (const rec of recs) {
            for (const name of [rec.homeTeam, rec.awayTeam]) {
                const trimmed = (name || '').trim();
                if (!trimmed) continue;
                const norm = this.normalizeTeamName(trimmed);
                if (!norm) continue;
                if (!pool.has(norm)) pool.set(norm, trimmed);
            }
        }

        const followed = await this.prisma.followedTeam.findMany({
            where: { userId },
            select: { normalizedName: true },
        });
        const followedSet = new Set(followed.map(f => f.normalizedName));

        const matches: Array<{ norm: string; name: string }> = [];
        for (const [norm, name] of pool.entries()) {
            if (followedSet.has(norm)) continue;
            if (norm.includes(normalizedQ) || normalizedQ.includes(norm)) {
                matches.push({ norm, name });
            }
        }

        // Prefer prefix matches, then alphabetical.
        matches.sort((a, b) => {
            const aPrefix = a.norm.startsWith(normalizedQ) ? 0 : 1;
            const bPrefix = b.norm.startsWith(normalizedQ) ? 0 : 1;
            if (aPrefix !== bPrefix) return aPrefix - bPrefix;
            return a.name.localeCompare(b.name);
        });
        return {
            options: matches.slice(0, 12).map(m => ({ name: m.name })),
        };
    }

    async getUpcomingForFollowedTeams(userId: string, days: number = 7) {
        const windowDays = Number.isFinite(days) ? Math.min(Math.max(days, 1), 30) : 7;
        const now = new Date();
        const end = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000);

        const followed = await this.prisma.followedTeam.findMany({
            where: { userId },
            select: { teamName: true, normalizedName: true },
        });
        const norms = new Set(followed.map(f => f.normalizedName));
        if (norms.size === 0) return { matches: [] as any[] };

        const recs = await this.prisma.recommendation.findMany({
            where: {
                commenceTime: { gt: now, lte: end },
            },
            select: {
                id: true,
                sportKey: true,
                eventTitle: true,
                homeTeam: true,
                awayTeam: true,
                commenceTime: true,
            },
            orderBy: { commenceTime: 'asc' },
            take: 2500,
        });

        const matches: Array<{
            id: string;
            sportKey: string;
            homeTeam: string;
            awayTeam: string;
            commenceTime: string;
            matchedTeams: string[];
        }> = [];

        for (const rec of recs) {
            const home = (rec.homeTeam || '').trim();
            const away = (rec.awayTeam || '').trim();
            if (!home || !away) continue;
            const homeNorm = this.normalizeTeamName(home);
            const awayNorm = this.normalizeTeamName(away);
            const matchedTeams: string[] = [];
            if (homeNorm && norms.has(homeNorm)) matchedTeams.push(home);
            if (awayNorm && norms.has(awayNorm)) matchedTeams.push(away);
            if (matchedTeams.length === 0) continue;

            matches.push({
                id: rec.id,
                sportKey: rec.sportKey,
                homeTeam: home,
                awayTeam: away,
                commenceTime: rec.commenceTime.toISOString(),
                matchedTeams,
            });
        }

        // Deduplicate same fixture if multiple recommendations exist.
        const byFixture = new Map<string, typeof matches[number]>();
        for (const m of matches) {
            const key = `${m.homeTeam}::${m.awayTeam}::${m.commenceTime.slice(0, 16)}`;
            if (!byFixture.has(key)) byFixture.set(key, m);
        }

        return { matches: Array.from(byFixture.values()) };
    }

    private safeParseJsonArray(text?: string | null): string[] {
        if (!text) return [];
        try {
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((x): x is string => typeof x === 'string');
        } catch {
            return [];
        }
    }

    private normalizeTeamName(name: string) {
        return (name || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[\.\-,'"]/g, '')
            .replace(/\b(fc|cf|ac|afc|ssc|ud|cd|sv|vfb|vfl|rb|sc|fk|the|club)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

