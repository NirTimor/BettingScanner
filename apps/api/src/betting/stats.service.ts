import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StatsService {
    private readonly logger = new Logger(StatsService.name);
    private readonly apiKey: string;
    private readonly baseUrl = 'https://v3.football.api-sports.io';
    private readonly sportsDbKey: string;
    private readonly sportsDbBaseUrl: string;
    private readonly footballDataToken: string;
    private readonly footballDataBaseUrl = 'https://api.football-data.org/v4';

    // Cache
    private teamIdCache = new Map<string, number>();
    private marketMap = new Map<string, number>([
        ['soccer_epl', 39], // Premier League
        ['soccer_spain_la_liga', 140], // La Liga
        ['soccer_germany_bundesliga', 78], // Bundesliga
        ['soccer_italy_serie_a', 135], // Serie A
        ['soccer_france_ligue_one', 61], // Ligue 1
        ['soccer_fifa_world_cup', 1], // FIFA World Cup
    ]);
    private competitionMap = new Map<string, string>([
        ['soccer_epl', 'PL'],
        ['soccer_spain_la_liga', 'PD'],
        ['soccer_germany_bundesliga', 'BL1'],
        ['soccer_italy_serie_a', 'SA'],
        ['soccer_france_ligue_one', 'FL1'],
        ['soccer_uefa_champs_league', 'CL'],
        ['soccer_uefa_europa_league', 'EL'],
        ['soccer_uefa_europa_conference_league', 'ECL'],
        ['soccer_fifa_world_cup', 'WC'],
    ]);
    private competitionSeasonMap = new Map<string, string>([
        ['WC', '2026'],
    ]);
    private competitionTeamsCache = new Map<string, Array<{ id: number; name: string; shortName?: string; tla?: string }>>();

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.getOrThrow<string>('API_FOOTBALL_KEY');
        this.sportsDbKey = this.configService.get<string>('THE_SPORTS_DB_KEY') || '3';
        this.sportsDbBaseUrl = `https://www.thesportsdb.com/api/v1/json/${this.sportsDbKey}`;
        this.footballDataToken = this.configService.get<string>('FOOTBALL_DATA_TOKEN') || '';
    }

    private normalizeTeamName(name: string) {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[\.\-,'"]/g, '')
            .replace(/\b(fc|cf|ac|afc|ssc|ud|cd|sv|vfb|vfl|rb|sc|fk|the|club)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private readonly sportsDbTeamIdMap: Record<string, string> = {
        // Explicit overrides for common teams
        'arsenal': '133604',
        'borussia dortmund': '134753',
        'bayern munich': '133712',
        'barcelona': '133739',
        'villarreal': '134739',
        'leeds united': '133635',
    };

    private readonly teamNameAliases: Record<string, string> = {
        'usa': 'United States',
        'united states': 'United States',
        'south korea': 'Korea Republic',
        'korea republic': 'Korea Republic',
        'republic of korea': 'Korea Republic',
        'ivory coast': "Côte d'Ivoire",
        "cote d'ivoire": "Côte d'Ivoire",
        'czechia': 'Czech Republic',
        'czech republic': 'Czech Republic',
        'bosnia and herzegovina': 'Bosnia-Herzegovina',
        'bosnia herzegovina': 'Bosnia-Herzegovina',
        'north macedonia': 'Macedonia',
        'republic of ireland': 'Ireland',
        'northern ireland': 'Northern Ireland',
        'turkiye': 'Turkey',
        'türkiye': 'Turkey',
    };

    private async fetchApi(endpoint: string, params: Record<string, string> = {}) {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        try {
            const response = await fetch(url.toString(), {
                headers: {
                    'x-rapidapi-key': this.apiKey,
                    'x-rapidapi-host': 'v3.football.api-sports.io'
                }
            });

            if (!response.ok) {
                if (response.status === 429) {
                    return null;
                }
                this.logger.error(`API Error: ${response.statusText}`);
                return null;
            }

            const data = await response.json();

            if (data.errors && Object.keys(data.errors).length > 0) {
                if (data.errors.requests) {
                    return null;
                }
                this.logger.error('API-Football returned errors', data.errors);
                return null;
            }

            return data.response;
        } catch (error) {
            this.logger.error(`Failed to fetch ${endpoint}`, error);
            return null;
        }
    }

    private async fetchSportsDb(endpoint: string, params: Record<string, string> = {}) {
        const url = new URL(`${this.sportsDbBaseUrl}${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        try {
            const response = await fetch(url.toString());
            if (!response.ok) return null;
            return await response.json();
        } catch {
            return null;
        }
    }

    private async fetchFootballData(endpoint: string, params: Record<string, string> = {}) {
        if (!this.footballDataToken) return null;
        const url = new URL(`${this.footballDataBaseUrl}${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        try {
            const response = await fetch(url.toString(), {
                headers: { 'X-Auth-Token': this.footballDataToken },
            });
            if (!response.ok) return null;
            return await response.json();
        } catch {
            return null;
        }
    }

    async getTeamId(teamName: string): Promise<number | null> {
        if (this.teamIdCache.has(teamName)) {
            return this.teamIdCache.get(teamName)!;
        }

        for (const candidate of this.getTeamNameCandidates(teamName)) {
            const teamId = await this.lookupTeamId(candidate);
            if (teamId) {
                this.teamIdCache.set(teamName, teamId);
                return teamId;
            }
        }

        return null;
    }

    private getTeamNameCandidates(teamName: string) {
        const trimmed = teamName.trim();
        const normalized = this.normalizeTeamName(trimmed);
        const alias = this.teamNameAliases[normalized];
        const candidates = new Set<string>([trimmed]);
        if (alias) candidates.add(alias);
        return Array.from(candidates);
    }

    private async lookupTeamId(teamName: string): Promise<number | null> {
        this.logger.debug(`Searching ID for team: ${teamName}`);
        const searchResponse = await this.fetchApi('/teams', { search: teamName });
        if (searchResponse && searchResponse.length > 0) {
            const normalizedTarget = this.normalizeTeamName(teamName);
            const exact = searchResponse.find((entry: any) =>
                this.normalizeTeamName(entry.team?.name || '') === normalizedTarget
                || this.normalizeTeamName(entry.team?.code || '') === normalizedTarget.replace(/\s+/g, ''),
            );
            return (exact || searchResponse[0]).team.id;
        }

        const response = await this.fetchApi('/teams', { name: teamName });
        if (response && response.length > 0) {
            return response[0].team.id;
        }

        return null;
    }

    private async getRecentResultsFootballData(teamName: string, sportKey?: string): Promise<{ form: string; matches: Array<{ date: string; opponent: string; scored: number; conceded: number; isHome: boolean; result: string }>; source: string } | null> {
        const competitionCode = sportKey ? this.competitionMap.get(sportKey) : undefined;
        if (!competitionCode) return null;

        const season = this.competitionSeasonMap.get(competitionCode);
        const cacheKey = season ? `${competitionCode}:${season}` : competitionCode;

        let teams = this.competitionTeamsCache.get(cacheKey);
        if (!teams) {
            const teamsResponse = await this.fetchFootballData(
                `/competitions/${competitionCode}/teams`,
                season ? { season } : {},
            );
            teams = Array.isArray(teamsResponse?.teams)
                ? teamsResponse.teams.map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    shortName: t.shortName,
                    tla: t.tla,
                }))
                : [];
            this.competitionTeamsCache.set(cacheKey, teams);
        }

        const normalized = this.normalizeTeamName(teamName);
        const team = teams.find(t => this.normalizeTeamName(t.name) === normalized)
            || teams.find(t => this.normalizeTeamName(t.shortName || '') === normalized)
            || teams.find(t => (t.tla || '').toLowerCase() === normalized.replace(/\s+/g, '').toLowerCase())
            || teams.find(t => this.normalizeTeamName(t.name).includes(normalized) || normalized.includes(this.normalizeTeamName(t.name)));

        if (!team) return null;

        const matchesResponse = await this.fetchFootballData(`/teams/${team.id}/matches`, {
            status: 'FINISHED',
            limit: '5',
        });

        const matches = Array.isArray(matchesResponse?.matches) ? matchesResponse.matches : [];
        if (matches.length === 0) return null;

        const mapped = matches.map((match: any) => {
            const homeName = match.homeTeam?.name;
            const awayName = match.awayTeam?.name;
            const homeScore = match.score?.fullTime?.home;
            const awayScore = match.score?.fullTime?.away;
            if (!homeName || !awayName || typeof homeScore !== 'number' || typeof awayScore !== 'number') return null;
            const normalizedHome = this.normalizeTeamName(homeName);
            const normalizedAway = this.normalizeTeamName(awayName);
            if (normalizedHome === normalizedAway) return null;
            const isHome = normalizedHome === normalized;
            const isAway = normalizedAway === normalized;
            if (!isHome && !isAway) return null;
            const scored = isHome ? homeScore : awayScore;
            const conceded = isHome ? awayScore : homeScore;
            const opponent = isHome ? awayName : homeName;
            const result = scored === conceded ? 'D' : scored > conceded ? 'W' : 'L';
            return {
                date: (match.utcDate || '').slice(0, 10),
                opponent,
                scored,
                conceded,
                isHome,
                result,
            };
        }).filter(Boolean) as Array<{ date: string; opponent: string; scored: number; conceded: number; isHome: boolean; result: string }>;

        if (mapped.length === 0) return null;
        return { form: mapped.map(m => m.result).join(','), matches: mapped, source: 'football-data' };
    }

    private async getRecentResultsApiFootball(teamName: string): Promise<{ form: string; matches: Array<{ date: string; opponent: string; scored: number; conceded: number; isHome: boolean; result: string }>; source: string } | null> {
        const teamId = await this.getTeamId(teamName);
        if (!teamId) return null;

        const response = await this.fetchApi('/fixtures', {
            team: teamId.toString(),
            last: '5',
            status: 'FT',
        });
        if (!response || response.length === 0) return null;

        const normalizedTeam = this.normalizeTeamName(teamName);
        const matches = response.map((fixture: any) => {
            const homeName = fixture.teams?.home?.name;
            const awayName = fixture.teams?.away?.name;
            const homeScore = fixture.goals?.home;
            const awayScore = fixture.goals?.away;
            if (!homeName || !awayName || typeof homeScore !== 'number' || typeof awayScore !== 'number') return null;

            const normalizedHome = this.normalizeTeamName(homeName);
            const normalizedAway = this.normalizeTeamName(awayName);
            if (normalizedHome === normalizedAway) return null;

            const isHome = normalizedHome === normalizedTeam;
            const isAway = normalizedAway === normalizedTeam;
            if (!isHome && !isAway) return null;

            const scored = isHome ? homeScore : awayScore;
            const conceded = isHome ? awayScore : homeScore;
            const opponent = isHome ? awayName : homeName;
            const result = scored === conceded ? 'D' : scored > conceded ? 'W' : 'L';
            return {
                date: (fixture.fixture?.date || '').slice(0, 10),
                opponent,
                scored,
                conceded,
                isHome,
                result,
            };
        }).filter(Boolean) as Array<{ date: string; opponent: string; scored: number; conceded: number; isHome: boolean; result: string }>;

        if (matches.length === 0) return null;
        const form = matches.map(m => m.result).join(',');
        return { form, matches, source: 'api-football' };
    }

    async getRecentResults(teamName: string, sportKey?: string): Promise<{ form: string; matches: Array<{ date: string; opponent: string; scored: number; conceded: number; isHome: boolean; result: string }>; source: string } | null> {
        const footballData = await this.getRecentResultsFootballData(teamName, sportKey);
        if (footballData) return footballData;

        const apiFootball = await this.getRecentResultsApiFootball(teamName);
        if (apiFootball) return apiFootball;

        const normalized = this.normalizeTeamName(teamName);
        const manualId = this.sportsDbTeamIdMap[normalized];
        if (manualId) {
            const lastManual = await this.fetchSportsDb('/eventslast.php', { id: manualId });
            const resultsManual = Array.isArray(lastManual?.results) ? lastManual.results.slice(0, 5) : [];
            if (resultsManual.length > 0) {
                const matchesManual = resultsManual
                    .map((match: any) => {
                        const home = match.strHomeTeam;
                        const away = match.strAwayTeam;
                        const homeScore = Number(match.intHomeScore);
                        const awayScore = Number(match.intAwayScore);
                        if (!home || !away || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;

                        const normalizedHome = this.normalizeTeamName(home);
                        const normalizedAway = this.normalizeTeamName(away);
                        if (normalizedHome === normalizedAway) return null;
                        const isHome = normalizedHome === normalized;
                        const isAway = normalizedAway === normalized;
                        if (!isHome && !isAway) return null;
                        const scored = isHome ? homeScore : awayScore;
                        const conceded = isHome ? awayScore : homeScore;
                        const opponent = isHome ? away : home;
                        const result = scored === conceded ? 'D' : scored > conceded ? 'W' : 'L';

                        return {
                            date: match.dateEvent || '',
                            opponent,
                            scored,
                            conceded,
                            isHome,
                            result,
                        };
                    })
                    .filter(Boolean) as Array<{ date: string; opponent: string; scored: number; conceded: number; isHome: boolean; result: string }>;

                if (matchesManual.length > 0) {
                    const form = matchesManual.map(m => m.result).join(',');
                    return { form, matches: matchesManual, source: 'sportsdb' };
                }
            }
        }

        const findTeamFromSearch = (searchResults: any, target: string) => {
            const teams = Array.isArray(searchResults?.teams) ? searchResults.teams : [];
            if (teams.length === 0) return null;
            const exact = teams.find((t: any) => this.normalizeTeamName(t.strTeam || '') === target);
            if (exact) return exact;
            const partial = teams.find((t: any) => {
                const normalized = this.normalizeTeamName(t.strTeam || '');
                return normalized.includes(target) || target.includes(normalized);
            });
            return partial || teams[0];
        };

        let search = await this.fetchSportsDb('/searchteams.php', { t: teamName });
        let team = findTeamFromSearch(search, normalized);

        if (!team) {
            const simplified = teamName.replace(/\b(fc|cf|ac|afc|ssc|ud|cd|sv|vfb|vfl|rb|sc|fk|the|club)\b/gi, '').trim();
            if (simplified && simplified !== teamName) {
                search = await this.fetchSportsDb('/searchteams.php', { t: simplified });
                team = findTeamFromSearch(search, this.normalizeTeamName(simplified));
            }
        }

        const teamId = team?.idTeam;
        if (!teamId) return null;

        const last = await this.fetchSportsDb('/eventslast.php', { id: teamId.toString() });
        const results = Array.isArray(last?.results) ? last.results.slice(0, 5) : [];
        if (results.length === 0) return null;

        const matches = results
            .map((match: any) => {
                const home = match.strHomeTeam;
                const away = match.strAwayTeam;
                const homeScore = Number(match.intHomeScore);
                const awayScore = Number(match.intAwayScore);
                if (!home || !away || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;

                const normalizedHome = this.normalizeTeamName(home);
                const normalizedAway = this.normalizeTeamName(away);
                if (normalizedHome === normalizedAway) return null;
                const normalizedTeam = this.normalizeTeamName(teamName);
                const isHome = normalizedHome === normalizedTeam;
                const isAway = normalizedAway === normalizedTeam;
                if (!isHome && !isAway) return null;
                const scored = isHome ? homeScore : awayScore;
                const conceded = isHome ? awayScore : homeScore;
                const opponent = isHome ? away : home;
                const result = scored === conceded ? 'D' : scored > conceded ? 'W' : 'L';

                return {
                    date: match.dateEvent || '',
                    opponent,
                    scored,
                    conceded,
                    isHome,
                    result,
                };
            })
            .filter(Boolean) as Array<{ date: string; opponent: string; scored: number; conceded: number; isHome: boolean; result: string }>;

        if (matches.length === 0) return null;

        const form = matches.map(m => m.result).join(',');
        return { form, matches, source: 'sportsdb' };
    }

    async getTeamInjuries(teamName: string): Promise<string[]> {
        const teamId = await this.getTeamId(teamName);
        if (!teamId) return [];
        this.logger.log(`Fetching injuries for ${teamName} (ID: ${teamId})`);
        const response = await this.fetchApi('/injuries', { team: teamId.toString() });
        if (!response || response.length === 0) return [];
        return response.map((item: any) => `${item.player.name} (${item.player.type || 'Unknown'})`);
    }

    async getForm(teamName: string): Promise<string> {
        const teamId = await this.getTeamId(teamName);
        if (!teamId) return 'Unknown';

        // Get last 5 matches
        const response = await this.fetchApi('/fixtures', {
            team: teamId.toString(),
            last: '5',
            status: 'FT' // Finished matches only
        });

        if (!response || response.length === 0) return 'Unknown';

        // Calculate form string (e.g., "W,L,W,D,W")
        // API response fixtures sorted by date? Usually they are.
        // We want latest first or last? "Last 5" usually implies temporal order.
        // Helper to check win/loss
        const form = response.map((fixture: any) => {
            const isHome = fixture.teams.home.id === teamId;
            const winner = fixture.teams.home.winner ? 'home' : (fixture.teams.away.winner ? 'away' : 'draw');

            if (winner === 'draw') return 'D';
            if (isHome && winner === 'home') return 'W';
            if (!isHome && winner === 'away') return 'W';
            return 'L';
        }).join(',');

        return form;
    }

    async getHeadToHead(homeTeam: string, awayTeam: string): Promise<string> {
        const homeId = await this.getTeamId(homeTeam);
        const awayId = await this.getTeamId(awayTeam);
        if (!homeId || !awayId) return 'Unknown';

        const response = await this.fetchApi('/fixtures/headtohead', {
            h2h: `${homeId}-${awayId}`,
            last: '5'
        });

        if (!response || response.length === 0) return 'No Recents';

        let homeWins = 0;
        let awayWins = 0;
        let draws = 0;

        response.forEach((match: any) => {
            if (match.teams.home.winner) {
                match.teams.home.id === homeId ? homeWins++ : awayWins++;
            } else if (match.teams.away.winner) {
                match.teams.away.id === awayId ? awayWins++ : homeWins++;
            } else {
                draws++;
            }
        });

        return `Last ${response.length}: ${homeWins}W-${draws}D-${awayWins}L`;
    }

    async getHeadToHeadRecentScores(homeTeam: string, awayTeam: string): Promise<Array<{ homeName: string; awayName: string; homeScore: number; awayScore: number; winner: string | null }> | null> {
        const homeId = await this.getTeamId(homeTeam);
        const awayId = await this.getTeamId(awayTeam);
        if (!homeId || !awayId) return null;

        const response = await this.fetchApi('/fixtures/headtohead', {
            h2h: `${homeId}-${awayId}`,
            last: '5',
            status: 'FT',
        });

        if (!response || response.length === 0) return null;

        const matches = response
            .map((match: any) => {
                const homeName = match.teams?.home?.name;
                const awayName = match.teams?.away?.name;
                const homeScore = match.goals?.home;
                const awayScore = match.goals?.away;
                if (typeof homeScore !== 'number' || typeof awayScore !== 'number' || !homeName || !awayName) return null;
                let winner: string | null = null;
                if (homeScore > awayScore) winner = homeName;
                else if (awayScore > homeScore) winner = awayName;
                return { homeName, awayName, homeScore, awayScore, winner };
            })
            .filter(Boolean) as Array<{ homeName: string; awayName: string; homeScore: number; awayScore: number; winner: string | null }>;

        return matches.length > 0 ? matches : null;
    }

    async getStandings(sportKey: string, teamName: string): Promise<{ rank: number, points: number, description: string } | null> {
        const teamId = await this.getTeamId(teamName);
        const leagueId = this.marketMap.get(sportKey);

        if (!teamId || !leagueId) return null;

        const currentYear = new Date().getFullYear();
        // Season might be previous year if early in year. Simple hack: try current, if empty try current-1? 
        // For European leagues, season is usually e.g., 2025 for 2025/2026 or 2025 for 2025 season.
        // API-Football season is usually the start year. So for 2025-2026 season, it is 2025.
        // Given current date Jan 2026, the season is 2025.
        // Ideally we fetch current active season for league, but hardcoding 2025 for now as we are in 2026 Jan.
        let season = currentYear;
        if (sportKey === 'soccer_fifa_world_cup') {
            season = 2026;
        } else if (new Date().getMonth() < 6) {
            season = currentYear - 1;
        }

        const response = await this.fetchApi('/standings', {
            league: leagueId.toString(),
            season: season.toString(),
            team: teamId.toString()
        });

        if (!response || response.length === 0 || !response[0].league.standings) return null;

        const data = response[0].league.standings[0][0]; // nested structure: response[0].league.standings[groupIndex][teamIndex]
        // But we filtered by team, so it should be precise.
        // Actually API response structure: response[0].league.standings is array of arrays (groups).
        // Since we filtered by team, likely only one entry deep inside.
        // Let's safe navigation.

        // Easier: Standings endpoint with team returns specific entry?
        // Let's hope so. If not debugging needed.
        // Assuming standard structure:
        const standing = response[0].league.standings.flat().find((s: any) => s.team.id === teamId);

        if (!standing) return null;

        return {
            rank: standing.rank,
            points: standing.points,
            description: standing.description || 'Mid-table'
        };
    }

    async getFinishedFixtureScore(homeTeam: string, awayTeam: string, dateKey: string): Promise<{ homeScore: number; awayScore: number } | null> {
        const homeId = await this.getTeamId(homeTeam);
        const awayId = await this.getTeamId(awayTeam);
        if (!homeId || !awayId) return null;

        const statuses = ['FT', 'AET', 'PEN'];
        for (const status of statuses) {
            const response = await this.fetchApi('/fixtures', {
                home: homeId.toString(),
                away: awayId.toString(),
                date: dateKey,
                status: status,
            });

            if (response && response.length > 0) {
                const match = response[0];
                const homeScore = match.goals?.home;
                const awayScore = match.goals?.away;
                if (typeof homeScore === 'number' && typeof awayScore === 'number') {
                    return { homeScore, awayScore };
                }
            }
        }

        return null;
    }

    async getLiveFixtureScore(homeTeam: string, awayTeam: string): Promise<{ homeScore: number; awayScore: number; status: string } | null> {
        const homeId = await this.getTeamId(homeTeam);
        const awayId = await this.getTeamId(awayTeam);
        if (!homeId || !awayId) return null;

        const response = await this.fetchApi('/fixtures', {
            home: homeId.toString(),
            away: awayId.toString(),
            live: 'all',
        });

        if (!response || response.length === 0) return null;

        const match = response[0];
        const homeScore = match.goals?.home;
        const awayScore = match.goals?.away;
        const status = match.fixture?.status?.short || 'LIVE';
        if (typeof homeScore === 'number' && typeof awayScore === 'number') {
            return { homeScore, awayScore, status };
        }

        return null;
    }
}
