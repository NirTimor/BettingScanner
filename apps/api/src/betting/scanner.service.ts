import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TheOddsApiService, OddsEvent } from './the-odds-api.service';
import { StatsService } from './stats.service';
import { LlmService, LlmPrediction } from './llm.service';

@Injectable()
export class ScannerService {
    private readonly logger = new Logger(ScannerService.name);

    constructor(
        private prisma: PrismaService,
        private oddsService: TheOddsApiService,
        private statsService: StatsService,
        private llmService: LlmService,
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_8AM)
    async handleDailyScan() {
        this.logger.log('Starting daily betting scan...');
        await this.scanDaily();
    }

    @Cron('0 30 23 * * *')
    async handleDailyResultsUpdate() {
        this.logger.log('Starting daily results update...');
        await this.updateResultsForDate();
    }

    async scanDaily() {
        // 1. Create Scan Record
        const scan = await this.prisma.bettingScan.create({
            data: { status: 'RUNNING' },
        });

        try {
            const sportKeys = [
                'soccer_epl',
                'soccer_germany_bundesliga',
                'soccer_italy_serie_a',
                'soccer_spain_la_liga',
                'soccer_france_ligue_one',
                'soccer_israel_ligat_ha_al',
                'soccer_israel_ligat_al',
                'soccer_uefa_champs_league',
            ];

            const recommendations: any[] = [];

            const regionsBySport: Record<string, string> = {
                soccer_israel_ligat_ha_al: 'us,eu,uk,au',
                soccer_israel_ligat_al: 'us,eu,uk,au',
            };

            for (const sportKey of sportKeys) {
                try {
                    const regions = regionsBySport[sportKey] || 'eu,uk';
                    const odds = await this.oddsService.getOdds(sportKey, regions);
                    this.logger.log(`Fetched ${odds.length} events for ${sportKey}`);
                    const upcomingEvents = this.filterUpcomingEvents(odds);
                    const skippedCount = odds.length - upcomingEvents.length;
                    if (skippedCount > 0) {
                        this.logger.log(`Skipped ${skippedCount} past events for ${sportKey}`);
                    }
                    if (upcomingEvents.length === 0) {
                        this.logger.warn(`No upcoming events for ${sportKey}`);
                    }
                    const leagueRecommendations = await this.analyzeOdds(upcomingEvents);
                    recommendations.push(...leagueRecommendations);
                } catch (error) {
                    this.logger.warn(`Skipping ${sportKey} due to fetch error: ${error}`);
                }
            }

            // 3. Save Recommendations
            this.logger.log(`Saving ${recommendations.length} recommendations...`);

            for (const rec of recommendations) {
                await this.prisma.recommendation.create({
                    data: {
                        ...rec,
                        scanId: scan.id,
                    },
                });
            }

            // 4. Update Scan Status
            await this.prisma.bettingScan.update({
                where: { id: scan.id },
                data: {
                    status: 'SUCCESS',
                    resultSummary: JSON.stringify({ count: recommendations.length }),
                },
            });

            this.logger.log(`Scan complete. Saved ${recommendations.length} recommendations.`);
            return recommendations;

        } catch (error) {
            this.logger.error('Scan failed', error);
            await this.prisma.bettingScan.update({
                where: { id: scan.id },
                data: { status: 'FAILED' },
            });
            throw error;
        }
    }

    async updateResultsForDate(date?: string) {
        const targetDate = this.getDateKey(date);
        const { startOfDay, endOfDay } = this.getDayBounds(date);

        const recommendations = await this.prisma.recommendation.findMany({
            where: {
                commenceTime: { gte: startOfDay, lt: endOfDay },
                resultOutcome: null,
            },
        });

        let updated = 0;
        let missing = 0;
        for (const rec of recommendations) {
            if (!rec.homeTeam || !rec.awayTeam) {
                missing += 1;
                continue;
            }

            const score = await this.statsService.getFinishedFixtureScore(rec.homeTeam, rec.awayTeam, targetDate);
            if (!score) {
                missing += 1;
                continue;
            }

            const outcome = this.getOutcome(score.homeScore, score.awayScore);
            const selectionOutcome = this.getSelectionOutcome(rec.selection, rec.homeTeam, rec.awayTeam);
            const isHit = selectionOutcome === 'UNKNOWN' ? null : selectionOutcome === outcome;

            await this.prisma.recommendation.update({
                where: { id: rec.id },
                data: {
                    resultHomeScore: score.homeScore,
                    resultAwayScore: score.awayScore,
                    resultOutcome: outcome,
                    isHit: isHit,
                    resultCheckedAt: new Date(),
                },
            });
            updated += 1;
        }

        return { date: targetDate, total: recommendations.length, updated, missing };
    }

    async getLiveScoreForMatch(homeTeam: string, awayTeam: string) {
        return this.statsService.getLiveFixtureScore(homeTeam, awayTeam);
    }

    private async analyzeOdds(events: OddsEvent[]) {
        const recommendations: any[] = [];
        this.logger.log(`Analyzing ${events.length} events...`);
        const formCache = new Map<string, string>();
        const recentResultsCache = new Map<string, { form: string; matches: Array<{ date: string; opponent: string; scored: number; conceded: number; isHome: boolean; result: string }> } | null>();
        const injuriesCache = new Map<string, string[]>();
        const h2hCache = new Map<string, string>();

        for (const event of events) {
            const homeTeam = event.home_team;
            const awayTeam = event.away_team;
            const h2hKey = `${homeTeam}::${awayTeam}`;
            const selections = [homeTeam, awayTeam, 'Draw'];
            const selectionStats = this.buildSelectionStats(event, selections);
            const marketImplied = this.getImpliedProbabilities(selectionStats);
            const marketFavorite = this.getMarketFavorite(marketImplied, homeTeam, awayTeam);
            const isHeavyFavorite = marketFavorite.impliedProb >= 0.6;

            const homeRecent = await this.getCachedRecentResults(recentResultsCache, homeTeam, event.sport_key);
            const awayRecent = await this.getCachedRecentResults(recentResultsCache, awayTeam, event.sport_key);
            const homeForm = homeRecent?.form || await this.getCachedForm(formCache, homeTeam);
            const awayForm = awayRecent?.form || await this.getCachedForm(formCache, awayTeam);
            const h2hStr = await this.getCachedH2h(h2hCache, h2hKey, homeTeam, awayTeam);
            const homeInjuries = await this.getCachedInjuries(injuriesCache, homeTeam);
            const awayInjuries = await this.getCachedInjuries(injuriesCache, awayTeam);
            const llmPrediction = await this.getLlmPrediction(event, homeForm, awayForm, h2hStr, homeInjuries, awayInjuries, selectionStats);
            let bestCandidate: any = null;
            let bestConfidence = -1;
            let bestEdge = -1;
            let fallbackCandidate: any = null;
            let fallbackImplied = 0;

            for (const selection of selections) {
                const stat = selectionStats.get(selection);
                if (!stat) continue;
                const bestOdds = stat.bestOdds;
                const bestBookmaker = stat.bestBookmaker;
                const averageOdds = stat.count > 0 ? stat.sumOdds / stat.count : 0;
                const valueThreshold = 1.05; // 5% edge

                const selectionImplied = marketImplied.get(selection) || 0;
                const minUnderdogProb = isHeavyFavorite ? 0.3 : 0.2;
                if (selection !== marketFavorite.selection && selectionImplied < minUnderdogProb) {
                    continue;
                }
                // Allow draws; no extra block here.

                if (averageOdds > 0 && bestOdds > averageOdds * valueThreshold) {
                    // Logic specific to the team we are betting on
                    const teamToAnalyze = selection === homeTeam ? homeTeam : (selection === awayTeam ? awayTeam : null);

                    // 1. Value Score
                    const edgePercent = ((bestOdds - averageOdds) / averageOdds * 100);
                    const valueScore = Math.min(edgePercent * 2, 40);

                    // 2. Stats Analysis
                    let formScore = 0;
                    let h2hScore = 0;
                    let marketScore = Math.round(Math.min(selectionImplied * 40, 40));
                    let llmScore = 0;
                    const insights: string[] = [];

                    if (teamToAnalyze) {
                        try {
                            // FORM
                            const formStr = teamToAnalyze === homeTeam ? homeForm : awayForm;
                            if (formStr !== 'Unknown') {
                                const results = formStr.split(',');
                                const points = results.reduce((acc, r) => acc + (r === 'W' ? 3 : (r === 'D' ? 1 : 0)), 0);
                                formScore = (points / 15) * 30; // 30% weight
                                insights.push(`Form: ${formStr.replace(/,/g, '-')}`);
                            } else {
                                insights.push('Form: unavailable');
                            }

                            // H2H (Only relevant for Home/Away, not Draw directly/asymmetrically)
                            if (h2hStr !== 'No Recents' && h2hStr !== 'Unknown') {
                                const wins = parseInt(h2hStr.match(/(\d+)W/)?.[1] || '0');
                                const losses = parseInt(h2hStr.match(/(\d+)L/)?.[1] || '0');

                                // H2H Logic relative to selection
                                if (selection === homeTeam) {
                                    // Check if Home team dominates
                                    if (wins > losses) h2hScore = 20;
                                    else if (wins === losses) h2hScore = 10;
                                    else h2hScore = 5;
                                } else if (selection === awayTeam) {
                                    // StatsService returns `... ${homeWins}W-${draws}D-${awayWins}L`
                                    // Here, `losses` is parsed from the trailing `L` and corresponds to awayWins.
                                    if (losses > wins) h2hScore = 20;
                                    else if (losses === wins) h2hScore = 10;
                                    else h2hScore = 5;
                                }

                                insights.push(`H2H: ${h2hStr}`);
                            } else if (h2hStr === 'No Recents') {
                                insights.push('H2H: no recent matches');
                            } else {
                                insights.push('H2H: unavailable');
                            }

                            // INJURIES
                            const injuries = teamToAnalyze === homeTeam ? homeInjuries : awayInjuries;
                            if (injuries.length > 0) {
                                insights.push(`⚠️ Injury Alert: ${injuries.slice(0, 2).join(', ')}`);
                                formScore = Math.max(0, formScore - 15);
                            } else {
                                insights.push('Fitness: no major injuries reported');
                            }

                        } catch (e) {
                            this.logger.warn(`Analysis failed for ${selection}: ${e}`);
                        }
                    } else {
                        // DRAW Analysis
                        insights.push("Draw prediction relies heavily on value edge.");
                        h2hScore = 10;
                        formScore = 15; // Neutral
                    }

                    // Total Confidence
                    if (llmPrediction) {
                        const llmProb = this.getLlmProbability(llmPrediction, selection, homeTeam, awayTeam);
                        llmScore = Math.round(llmProb * 30);
                        insights.push(`LLM prob: ${(llmProb * 100).toFixed(0)}%`);
                    }
                    insights.push(`Market implied: ${(selectionImplied * 100).toFixed(0)}%`);
                    insights.push(`Market favorite: ${marketFavorite.selection}`);

                    const confidence = Math.round(valueScore + formScore + h2hScore + marketScore + llmScore);
                    let label = "Hard to Predict";
                    if (confidence >= 80) label = "High Confidence";
                    else if (confidence >= 60) label = "Medium Confidence";
                    else if (confidence >= 50) label = "Risky Value";
                    if (confidence < 50) {
                        continue;
                    }

                    const secondarySelections =
                        confidence < 60
                            ? Array.from(marketImplied.entries())
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 2)
                                .map(([name]) => name)
                            : undefined;

                    const summaryParts = [
                        `Value edge ${edgePercent.toFixed(1)}% with ${marketFavorite.selection} as market favorite`,
                    ];
                    if (insights.length > 0) summaryParts.push(insights[0]);
                    if (insights.length > 1) summaryParts.push(insights[1]);
                    const summary = summaryParts.join('. ');

                    const analysisObj = {
                        edge: `${edgePercent.toFixed(1)}%`,
                        confidence: confidence,
                        insights: insights,
                        summary,
                        homeForm,
                        awayForm,
                        marketFavorite: marketFavorite.selection,
                        selection,
                        homeRecent: homeRecent?.matches,
                        awayRecent: awayRecent?.matches,
                        ...(secondarySelections ? { secondarySelections } : {}),
                    };

                    const candidate = {
                        sportKey: event.sport_key,
                        eventTitle: `${event.home_team} vs ${event.away_team}`,
                        homeTeam: event.home_team,
                        awayTeam: event.away_team,
                        commenceTime: new Date(event.commence_time),
                        marketKey: 'h2h',
                        selection: selection,
                        odds: bestOdds,
                        bookmaker: bestBookmaker,
                        analysis: `AI: ${label}. Edge: ${edgePercent.toFixed(1)}%`,
                        confidenceScore: confidence,
                        predictionLabel: label,
                        aiAnalysis: JSON.stringify(analysisObj)
                    };

                    if (
                        confidence > bestConfidence ||
                        (confidence === bestConfidence && edgePercent > bestEdge)
                    ) {
                        bestCandidate = candidate;
                        bestConfidence = confidence;
                        bestEdge = edgePercent;
                    }
                }

                if (!fallbackCandidate && selection === marketFavorite.selection) {
                    fallbackCandidate = {
                        sportKey: event.sport_key,
                        eventTitle: `${event.home_team} vs ${event.away_team}`,
                        homeTeam: event.home_team,
                        awayTeam: event.away_team,
                        commenceTime: new Date(event.commence_time),
                        marketKey: 'h2h',
                        selection: selection,
                        odds: bestOdds,
                        bookmaker: bestBookmaker,
                        analysis: `AI: Market favorite. Edge: ${(((bestOdds - averageOdds) / averageOdds) * 100).toFixed(1)}%`,
                        confidenceScore: Math.round(Math.min(selectionImplied * 40, 40)),
                        predictionLabel: 'Market Favorite',
                        aiAnalysis: JSON.stringify({
                            edge: `${(((bestOdds - averageOdds) / averageOdds) * 100).toFixed(1)}%`,
                            confidence: Math.round(Math.min(selectionImplied * 40, 40)),
                            insights: [
                                `Market implied: ${(selectionImplied * 100).toFixed(0)}%`,
                                `Market favorite: ${marketFavorite.selection}`,
                            ],
                        }),
                    };
                    fallbackImplied = selectionImplied;
                } else if (selection === marketFavorite.selection && selectionImplied > fallbackImplied) {
                    fallbackImplied = selectionImplied;
                }
            }

            if (bestCandidate) {
                recommendations.push(bestCandidate);
            } else if (fallbackCandidate) {
                recommendations.push(fallbackCandidate);
            }
        }
        return recommendations;
    }

    private buildSelectionStats(event: OddsEvent, selections: string[]) {
        const stats = new Map<string, { sumOdds: number; count: number; bestOdds: number; bestBookmaker: string }>();
        selections.forEach(selection => {
            stats.set(selection, { sumOdds: 0, count: 0, bestOdds: 0, bestBookmaker: '' });
        });

        event.bookmakers.forEach(bookmaker => {
            const h2hBook = bookmaker.markets.find(m => m.key === 'h2h');
            if (!h2hBook) return;

            h2hBook.outcomes.forEach(outcome => {
                const stat = stats.get(outcome.name);
                if (!stat) return;
                stat.sumOdds += outcome.price;
                stat.count += 1;
                if (outcome.price > stat.bestOdds) {
                    stat.bestOdds = outcome.price;
                    stat.bestBookmaker = bookmaker.title;
                }
            });
        });

        return stats;
    }

    private getImpliedProbabilities(
        selectionStats: Map<string, { sumOdds: number; count: number; bestOdds: number; bestBookmaker: string }>
    ) {
        const implied = new Map<string, number>();
        for (const [selection, stat] of selectionStats.entries()) {
            const avgOdds = stat.count > 0 ? stat.sumOdds / stat.count : 0;
            implied.set(selection, avgOdds > 0 ? 1 / avgOdds : 0);
        }
        return implied;
    }

    private getMarketFavorite(
        implied: Map<string, number>,
        homeTeam: string,
        awayTeam: string,
    ) {
        const entries = Array.from(implied.entries());
        let favorite = entries[0] || [homeTeam, 0];
        for (const entry of entries) {
            if (entry[1] > favorite[1]) favorite = entry;
        }
        const selection = favorite[0];
        const impliedProb = favorite[1] || 0;
        const label = selection === homeTeam ? 'HOME' : selection === awayTeam ? 'AWAY' : 'DRAW';
        return { selection, impliedProb, label };
    }

    private async getCachedForm(cache: Map<string, string>, team: string) {
        if (!cache.has(team)) {
            cache.set(team, await this.statsService.getForm(team));
        }
        return cache.get(team) || 'Unknown';
    }

    private async getCachedRecentResults(
        cache: Map<string, { form: string; matches: Array<{ date: string; opponent: string; scored: number; conceded: number; isHome: boolean; result: string }> } | null>,
        team: string,
        sportKey?: string
    ) {
        if (!cache.has(team)) {
            cache.set(team, await this.statsService.getRecentResults(team, sportKey));
        }
        return cache.get(team) || null;
    }

    private async getCachedInjuries(cache: Map<string, string[]>, team: string) {
        if (!cache.has(team)) {
            cache.set(team, await this.statsService.getTeamInjuries(team));
        }
        return cache.get(team) || [];
    }

    private async getCachedH2h(cache: Map<string, string>, key: string, homeTeam: string, awayTeam: string) {
        if (!cache.has(key)) {
            cache.set(key, await this.statsService.getHeadToHead(homeTeam, awayTeam));
        }
        return cache.get(key) || 'Unknown';
    }

    private async getLlmPrediction(
        event: OddsEvent,
        homeForm: string,
        awayForm: string,
        h2hStr: string,
        homeInjuries: string[],
        awayInjuries: string[],
        selectionStats: Map<string, { sumOdds: number; count: number; bestOdds: number; bestBookmaker: string }>
    ): Promise<LlmPrediction | null> {
        if (!this.llmService.isEnabled()) return null;

        const homeAvg = this.getAverageOdds(selectionStats.get(event.home_team));
        const awayAvg = this.getAverageOdds(selectionStats.get(event.away_team));
        const drawAvg = this.getAverageOdds(selectionStats.get('Draw'));

        return this.llmService.getMatchPrediction({
            homeTeam: event.home_team,
            awayTeam: event.away_team,
            odds: {
                home: homeAvg,
                draw: drawAvg,
                away: awayAvg,
            },
            form: {
                home: homeForm,
                away: awayForm,
            },
            h2h: h2hStr,
            injuries: {
                home: homeInjuries,
                away: awayInjuries,
            },
        });
    }

    private getAverageOdds(stat?: { sumOdds: number; count: number }) {
        if (!stat || stat.count === 0) return null;
        return stat.sumOdds / stat.count;
    }

    private getLlmProbability(prediction: LlmPrediction, selection: string, homeTeam: string, awayTeam: string) {
        if (selection === homeTeam) return prediction.home;
        if (selection === awayTeam) return prediction.away;
        return prediction.draw;
    }

    private filterUpcomingEvents(events: OddsEvent[]) {
        const now = new Date();
        return events.filter(event => {
            const commenceTime = new Date(event.commence_time);
            return Number.isFinite(commenceTime.getTime()) && commenceTime > now;
        });
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

    private getDateKey(date?: string) {
        if (date) return date;
        const now = new Date();
        const pad = (val: number) => val.toString().padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }
}
