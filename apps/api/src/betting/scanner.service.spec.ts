import { strict as assert } from 'node:assert';
import { ScannerService } from './scanner.service';
import { OddsEvent } from './the-odds-api.service';

const makeScanner = (forms: Record<string, string>, h2h: string) => {
    const statsService = {
        getRecentResults: async (team: string) => ({
            form: forms[team] || 'Unknown',
            matches: [],
        }),
        getForm: async (team: string) => forms[team] || 'Unknown',
        getHeadToHead: async () => h2h,
        getTeamInjuries: async () => [],
    };

    const llmService = {
        isEnabled: () => false,
    };

    return new ScannerService({} as any, {} as any, statsService as any, llmService as any) as any;
};

const makeEvent = (
    homeTeam: string,
    awayTeam: string,
    oddsByBookmaker: Array<{ title: string; home: number; draw: number; away: number }>,
): OddsEvent => ({
    id: `${homeTeam}-${awayTeam}`,
    sport_key: 'soccer_test',
    sport_title: 'Test League',
    commence_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    home_team: homeTeam,
    away_team: awayTeam,
    bookmakers: oddsByBookmaker.map(bookmaker => ({
        key: bookmaker.title.toLowerCase().replace(/\s+/g, '_'),
        title: bookmaker.title,
        last_update: new Date().toISOString(),
        markets: [{
            key: 'h2h',
            last_update: new Date().toISOString(),
            outcomes: [
                { name: homeTeam, price: bookmaker.home },
                { name: 'Draw', price: bookmaker.draw },
                { name: awayTeam, price: bookmaker.away },
            ],
        }],
    })),
});

async function testHomeValueCandidate() {
    const scanner = makeScanner({ Home: 'W,W,W,W,W', Away: 'L,L,D,L,L' }, '5W-0D-0L');
    const event = makeEvent('Home', 'Away', [
        { title: 'Book A', home: 2.3, draw: 3.5, away: 4.2 },
        { title: 'Book B', home: 1.95, draw: 3.4, away: 4.0 },
        { title: 'Book C', home: 1.96, draw: 3.6, away: 4.1 },
    ]);

    const recommendations = await scanner.analyzeOdds([event]);

    assert.equal(recommendations.length, 1);
    assert.equal(recommendations[0].selection, 'Home');
    assert.equal(recommendations[0].predictionLabel, 'High Confidence');
    assert.ok(recommendations[0].confidenceScore >= 80);
}

async function testAwayH2hCandidateUsesAwayWins() {
    const scanner = makeScanner({ Home: 'L,L,D,L,L', Away: 'W,W,W,W,W' }, '0W-0D-5L');
    const event = makeEvent('Home', 'Away', [
        { title: 'Book A', home: 4.2, draw: 3.5, away: 2.3 },
        { title: 'Book B', home: 4.0, draw: 3.4, away: 1.95 },
        { title: 'Book C', home: 4.1, draw: 3.6, away: 1.96 },
    ]);

    const recommendations = await scanner.analyzeOdds([event]);

    assert.equal(recommendations.length, 1);
    assert.equal(recommendations[0].selection, 'Away');
    assert.equal(recommendations[0].predictionLabel, 'High Confidence');
    assert.ok(recommendations[0].confidenceScore >= 80);
}

async function run() {
    await testHomeValueCandidate();
    await testAwayH2hCandidateUsesAwayWins();
    console.log('scanner.service.spec.ts passed');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
