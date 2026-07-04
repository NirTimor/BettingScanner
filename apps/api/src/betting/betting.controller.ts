import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScannerService } from './scanner.service';
import { StatsService } from './stats.service';
import { NotificationsService } from './notifications.service';
import { AdminOnly } from '../auth/admin.decorator';
@Controller('betting')
export class BettingController {
    constructor(
        private prisma: PrismaService,
        private scanner: ScannerService,
        private stats: StatsService,
        private notifications: NotificationsService,
    ) { }

    @Get('recommendations')
    async getRecommendations(@Query('date') date?: string) {
        const { startOfDay, endOfDay } = this.getDayBounds(date);
        const latestScanForDay = await this.prisma.bettingScan.findFirst({
            where: {
                scanDate: {
                    gte: startOfDay,
                    lt: endOfDay,
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const recommendations = await this.prisma.recommendation.findMany({
            where: latestScanForDay
                ? { scanId: latestScanForDay.id }
                : {
                    commenceTime: {
                        gte: startOfDay,
                        lt: endOfDay,
                    },
                },
            orderBy: { commenceTime: 'asc' },
        });

        const byEvent = new Map<string, any>();
        for (const rec of recommendations) {
            const existing = byEvent.get(rec.eventTitle);
            const currentScore = rec.confidenceScore ?? 0;
            const existingScore = existing?.confidenceScore ?? 0;
            if (!existing || currentScore > existingScore) {
                byEvent.set(rec.eventTitle, rec);
            }
        }

        return Array.from(byEvent.values());
    }

    @Post('results')
    @AdminOnly()
    async saveResult(
        @Body()
        body: {
            recommendationId: string;
            homeScore: number;
            awayScore: number;
        },
    ) {
        const { recommendationId, homeScore, awayScore } = body;
        const parsedHome = Number(homeScore);
        const parsedAway = Number(awayScore);
        if (!Number.isFinite(parsedHome) || !Number.isFinite(parsedAway) || parsedHome < 0 || parsedAway < 0) {
            return { error: 'Invalid score values' };
        }
        const recommendation = await this.prisma.recommendation.findUnique({
            where: { id: recommendationId },
        });

        if (!recommendation) {
            return { error: 'Recommendation not found' };
        }

        const outcome = this.getOutcome(parsedHome, parsedAway);
        const selectionOutcome = this.getSelectionOutcome(
            recommendation.selection,
            recommendation.homeTeam,
            recommendation.awayTeam,
        );
        const isHit = selectionOutcome === 'UNKNOWN' ? null : selectionOutcome === outcome;

        return this.prisma.recommendation.update({
            where: { id: recommendationId },
            data: {
                resultHomeScore: parsedHome,
                resultAwayScore: parsedAway,
                resultOutcome: outcome,
                isHit: isHit,
                resultCheckedAt: new Date(),
            },
        });
    }

    @Get('accuracy')
    async getAccuracy(@Query('date') date?: string) {
        const { startOfDay, endOfDay } = this.getDayBounds(date);
        const latestScanForDay = await this.prisma.bettingScan.findFirst({
            where: {
                scanDate: {
                    gte: startOfDay,
                    lt: endOfDay,
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const recommendations = await this.prisma.recommendation.findMany({
            where: latestScanForDay
                ? { scanId: latestScanForDay.id }
                : {
                    commenceTime: {
                        gte: startOfDay,
                        lt: endOfDay,
                    },
                },
            select: { isHit: true },
        });

        const total = recommendations.length;
        const graded = recommendations.filter(r => r.isHit !== null).length;
        const hits = recommendations.filter(r => r.isHit === true).length;
        const hitRate = graded > 0 ? Math.round((hits / graded) * 100) : 0;

        return { total, graded, hits, hitRate };
    }

    @Get('stats')
    async getStats(@Query('days') days?: string) {
        const parsedDays = Number.parseInt(days || '30', 10);
        const windowDays = Number.isFinite(parsedDays) ? Math.min(Math.max(parsedDays, 1), 365) : 30;
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(startDate.getDate() - windowDays);

        const recommendations = await this.prisma.recommendation.findMany({
            where: {
                commenceTime: { gte: startDate },
            },
            select: {
                sportKey: true,
                bookmaker: true,
                odds: true,
                isHit: true,
            },
        });

        const summarize = (items: Array<{ odds: any; isHit: boolean | null }>) => {
            const total = items.length;
            const gradedItems = items.filter(item => item.isHit !== null);
            const graded = gradedItems.length;
            const hits = gradedItems.filter(item => item.isHit === true).length;
            const hitRate = graded > 0 ? Math.round((hits / graded) * 100) : 0;
            const avgOdds = total > 0
                ? Number((items.reduce((sum, item) => sum + Number(item.odds || 0), 0) / total).toFixed(2))
                : 0;
            const profit = gradedItems.reduce((sum, item) => {
                const odds = Number(item.odds || 0);
                if (!Number.isFinite(odds) || odds <= 0) return sum;
                return sum + (item.isHit ? (odds - 1) : -1);
            }, 0);
            const roi = graded > 0 ? Number(((profit / graded) * 100).toFixed(2)) : 0;
            return { total, graded, hits, hitRate, roi, avgOdds };
        };

        const bySportMap = new Map<string, Array<{ odds: any; isHit: boolean | null }>>();
        const byBookmakerMap = new Map<string, Array<{ odds: any; isHit: boolean | null }>>();

        for (const rec of recommendations) {
            const sportBucket = bySportMap.get(rec.sportKey) || [];
            sportBucket.push({ odds: rec.odds, isHit: rec.isHit });
            bySportMap.set(rec.sportKey, sportBucket);

            const bookmaker = rec.bookmaker || 'Unknown';
            const bookBucket = byBookmakerMap.get(bookmaker) || [];
            bookBucket.push({ odds: rec.odds, isHit: rec.isHit });
            byBookmakerMap.set(bookmaker, bookBucket);
        }

        const bySport = Array.from(bySportMap.entries()).map(([key, items]) => ({
            key,
            ...summarize(items),
        })).sort((a, b) => b.total - a.total);

        const byBookmaker = Array.from(byBookmakerMap.entries()).map(([key, items]) => ({
            key,
            ...summarize(items),
        })).sort((a, b) => b.total - a.total);

        return {
            windowDays,
            ...summarize(recommendations),
            bySport,
            byBookmaker,
        };
    }

    @Get('stats/daily')
    async getDailyStats(@Query('days') days?: string) {
        const parsedDays = Number.parseInt(days || '30', 10);
        const windowDays = Number.isFinite(parsedDays) ? Math.min(Math.max(parsedDays, 1), 365) : 30;
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(startDate.getDate() - windowDays);

        const recommendations = await this.prisma.recommendation.findMany({
            where: {
                commenceTime: { gte: startDate },
            },
            select: {
                commenceTime: true,
                odds: true,
                isHit: true,
            },
        });

        const summarize = (items: Array<{ odds: any; isHit: boolean | null }>) => {
            const total = items.length;
            const gradedItems = items.filter(item => item.isHit !== null);
            const graded = gradedItems.length;
            const hits = gradedItems.filter(item => item.isHit === true).length;
            const hitRate = graded > 0 ? Math.round((hits / graded) * 100) : 0;
            const profit = gradedItems.reduce((sum, item) => {
                const odds = Number(item.odds || 0);
                if (!Number.isFinite(odds) || odds <= 0) return sum;
                return sum + (item.isHit ? (odds - 1) : -1);
            }, 0);
            const roi = graded > 0 ? Number(((profit / graded) * 100).toFixed(2)) : 0;
            return { total, graded, hits, hitRate, roi };
        };

        const byDate = new Map<string, Array<{ odds: any; isHit: boolean | null }>>();
        for (const rec of recommendations) {
            const key = rec.commenceTime.toISOString().slice(0, 10);
            const bucket = byDate.get(key) || [];
            bucket.push({ odds: rec.odds, isHit: rec.isHit });
            byDate.set(key, bucket);
        }

        const series: Array<{ date: string; total: number; graded: number; hits: number; hitRate: number; roi: number }> = [];
        for (let i = windowDays; i >= 0; i--) {
            const date = new Date();
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().slice(0, 10);
            const items = byDate.get(dateKey) || [];
            series.push({ date: dateKey, ...summarize(items) });
        }

        return {
            windowDays,
            series,
        };
    }

    @Post('scan')
    @AdminOnly()
    async triggerScan() {
        // For testing purposes
        return this.scanner.scanDaily();
    }

    @Post('results/auto')
    @AdminOnly()
    async autoResults(@Query('date') date?: string) {
        return this.scanner.updateResultsForDate(date);
    }

    @Post('results/auto-range')
    @AdminOnly()
    async autoResultsRange(@Query('days') days?: string) {
        const parsedDays = Number.parseInt(days || '7', 10);
        const windowDays = Number.isFinite(parsedDays) ? Math.min(Math.max(parsedDays, 1), 60) : 7;
        const results: Array<{ date: string; updated: number }> = [];

        for (let i = 0; i < windowDays; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().slice(0, 10);
            const updated = await this.scanner.updateResultsForDate(dateKey);
            results.push({ date: dateKey, updated: updated?.updated ?? 0 });
        }

        return { days: windowDays, results };
    }

    @Post('notify')
    @AdminOnly()
    async notify(@Query('date') date?: string) {
        return this.notifications.sendDailyUpdates(date);
    }

    @Post('results/clear')
    @AdminOnly()
    async clearResults(@Query('date') date?: string) {
        const { startOfDay, endOfDay } = this.getDayBounds(date);
        const result = await this.prisma.recommendation.updateMany({
            where: {
                commenceTime: { gte: startOfDay, lt: endOfDay },
            },
            data: {
                resultHomeScore: null,
                resultAwayScore: null,
                resultOutcome: null,
                isHit: null,
                resultCheckedAt: null,
            },
        });

        return { cleared: result.count };
    }

    @Get('live-scores')
    async getLiveScores(@Query('date') date?: string) {
        const { startOfDay, endOfDay } = this.getDayBounds(date);
        const recommendations = await this.prisma.recommendation.findMany({
            where: {
                commenceTime: { gte: startOfDay, lt: endOfDay },
                resultOutcome: null,
            },
        });

        const liveEntries = await Promise.all(recommendations.map(async (rec) => {
            if (!rec.homeTeam || !rec.awayTeam) return null;
            const live = await this.scanner.getLiveScoreForMatch(rec.homeTeam, rec.awayTeam);
            if (live) {
                return [rec.id, live] as const;
            }
            return null;
        }));

        return liveEntries.reduce<Record<string, { homeScore: number; awayScore: number; status: string }>>((acc, entry) => {
            if (entry) acc[entry[0]] = entry[1];
            return acc;
        }, {});
    }

    @Get('recent-results')
    async getRecentResults(
        @Query('homeTeam') homeTeam?: string,
        @Query('awayTeam') awayTeam?: string,
        @Query('sportKey') sportKey?: string,
    ) {
        if (!homeTeam || !awayTeam) {
            return {
                homeRecent: null,
                awayRecent: null,
                h2hRecent: null,
                sources: { home: 'none', away: 'none', h2h: 'none' },
                reasons: { home: 'missing-team', away: 'missing-team', h2h: 'missing-team' },
            };
        }

        const [homeRecent, awayRecent, h2hRecent] = await Promise.all([
            this.stats.getRecentResults(homeTeam, sportKey),
            this.stats.getRecentResults(awayTeam, sportKey),
            this.stats.getHeadToHeadRecentScores(homeTeam, awayTeam),
        ]);

        return {
            homeRecent,
            awayRecent,
            h2hRecent,
            sources: {
                home: homeRecent?.source ?? 'none',
                away: awayRecent?.source ?? 'none',
                h2h: h2hRecent ? 'api-football' : 'none',
            },
            reasons: {
                home: homeRecent ? null : 'no-data',
                away: awayRecent ? null : 'no-data',
                h2h: h2hRecent ? null : 'no-data',
            },
        };
    }

    private getOutcome(homeScore: number, awayScore: number) {
        if (homeScore === awayScore) return 'DRAW';
        return homeScore > awayScore ? 'HOME' : 'AWAY';
    }

    private getSelectionOutcome(selection: string, homeTeam?: string | null, awayTeam?: string | null) {
        if (!homeTeam || !awayTeam) return 'UNKNOWN';
        const normalized = selection.trim().toLowerCase();
        if (normalized === homeTeam.toLowerCase()) return 'HOME';
        if (normalized === awayTeam.toLowerCase()) return 'AWAY';
        if (normalized === 'draw') return 'DRAW';
        return 'UNKNOWN';
    }

    private getDayBounds(date?: string) {
        if (!date) {
            const now = new Date();
            return {
                startOfDay: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                endOfDay: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
            };
        }

        const parts = date.split('-').map(p => parseInt(p, 10));
        if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) {
            const now = new Date();
            return {
                startOfDay: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                endOfDay: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
            };
        }

        const [year, month, day] = parts;
        const startOfDay = new Date(year, month - 1, day);
        const endOfDay = new Date(year, month - 1, day + 1);
        return { startOfDay, endOfDay };
    }
}
