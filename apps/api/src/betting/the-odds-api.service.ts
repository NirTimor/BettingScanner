import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OddsEvent {
    id: string;
    sport_key: string;
    sport_title: string;
    commence_time: string;
    home_team: string;
    away_team: string;
    bookmakers: Bookmaker[];
}

export interface Bookmaker {
    key: string;
    title: string;
    last_update: string;
    markets: Market[];
}

export interface Market {
    key: string;
    last_update: string;
    outcomes: Outcome[];
}

export interface Outcome {
    name: string;
    price: number;
}

@Injectable()
export class TheOddsApiService {
    private readonly logger = new Logger(TheOddsApiService.name);
    private readonly apiKey: string;
    private readonly baseUrl = 'https://api.the-odds-api.com/v4';

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.getOrThrow<string>('THE_ODDS_API_KEY');
    }

    async getSports() {
        const url = `${this.baseUrl}/sports/?apiKey=${this.apiKey}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch sports: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            this.logger.error('Error fetching sports', error);
            throw error;
        }
    }

    async getOdds(sportKey: string, regions: string = 'eu,uk'): Promise<OddsEvent[]> {
        const url = `${this.baseUrl}/sports/${sportKey}/odds/?regions=${regions}&markets=h2h&oddsFormat=decimal&apiKey=${this.apiKey}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch odds for ${sportKey}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            this.logger.error(`Error fetching odds for ${sportKey}`, error);
            throw error;
        }
    }
}
