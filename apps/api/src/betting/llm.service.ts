import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type LlmProvider = 'openai' | 'gemini';

export interface LlmMatchInput {
    homeTeam: string;
    awayTeam: string;
    odds: {
        home: number | null;
        draw: number | null;
        away: number | null;
    };
    form?: {
        home?: string;
        away?: string;
    };
    h2h?: string;
    injuries?: {
        home?: string[];
        away?: string[];
    };
}

export interface LlmPrediction {
    home: number;
    draw: number;
    away: number;
    recommended: 'HOME' | 'DRAW' | 'AWAY';
    reason: string;
}

@Injectable()
export class LlmService {
    private readonly logger = new Logger(LlmService.name);
    private readonly provider: LlmProvider | null;
    private readonly apiKey: string | null;
    private readonly model: string;
    private readonly timeoutMs: number;

    constructor(private configService: ConfigService) {
        const rawProvider = this.configService.get<string>('LLM_PROVIDER')?.toLowerCase();
        this.provider = rawProvider === 'openai' || rawProvider === 'gemini' ? rawProvider : null;

        if (this.provider === 'openai') {
            this.apiKey = this.configService.get<string>('OPENAI_API_KEY') || null;
            this.model = this.configService.get<string>('LLM_MODEL') || 'gpt-4o-mini';
        } else if (this.provider === 'gemini') {
            this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || null;
            this.model = this.configService.get<string>('LLM_MODEL') || 'gemini-1.5-flash';
        } else {
            this.apiKey = null;
            this.model = this.configService.get<string>('LLM_MODEL') || 'gpt-4o-mini';
        }

        const timeout = this.configService.get<string>('LLM_TIMEOUT_MS');
        this.timeoutMs = timeout ? parseInt(timeout, 10) : 8000;
    }

    isEnabled() {
        return Boolean(this.provider && this.apiKey);
    }

    async getMatchPrediction(input: LlmMatchInput): Promise<LlmPrediction | null> {
        if (!this.provider || !this.apiKey) return null;

        try {
            if (this.provider === 'openai') {
                return await this.callOpenAi(input);
            }
            return await this.callGemini(input);
        } catch (error) {
            this.logger.warn(`LLM prediction failed: ${error}`);
            return null;
        }
    }

    private async callOpenAi(input: LlmMatchInput): Promise<LlmPrediction | null> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const payload = {
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content: [
                        'You are a football prediction assistant.',
                        'Return only valid JSON with probabilities for HOME/DRAW/AWAY that sum to 1.',
                        'Use the provided odds as a baseline and adjust using form, H2H and injuries.',
                    ].join(' ')
                },
                {
                    role: 'user',
                    content: this.buildPrompt(input),
                },
            ],
            temperature: 0.2,
        };

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            if (!response.ok) {
                const text = await response.text();
                this.logger.warn(`OpenAI error: ${response.status} ${text}`);
                return null;
            }

            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content;
            return this.parsePrediction(content);
        } finally {
            clearTimeout(timer);
        }
    }

    private async callGemini(input: LlmMatchInput): Promise<LlmPrediction | null> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        const payload = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: this.buildPrompt(input) }]
                }
            ],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 256,
            }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            if (!response.ok) {
                const text = await response.text();
                this.logger.warn(`Gemini error: ${response.status} ${text}`);
                return null;
            }

            const data = await response.json();
            const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            return this.parsePrediction(content);
        } finally {
            clearTimeout(timer);
        }
    }

    private buildPrompt(input: LlmMatchInput) {
        const odds = [
            `HOME: ${input.odds.home ?? 'n/a'}`,
            `DRAW: ${input.odds.draw ?? 'n/a'}`,
            `AWAY: ${input.odds.away ?? 'n/a'}`,
        ].join(', ');

        const form = [
            `HOME form: ${input.form?.home ?? 'unknown'}`,
            `AWAY form: ${input.form?.away ?? 'unknown'}`,
        ].join(', ');

        const h2h = `H2H: ${input.h2h ?? 'unknown'}`;
        const injuries = [
            `HOME injuries: ${(input.injuries?.home || []).slice(0, 3).join(', ') || 'none'}`,
            `AWAY injuries: ${(input.injuries?.away || []).slice(0, 3).join(', ') || 'none'}`,
        ].join(', ');

        return [
            `Match: ${input.homeTeam} vs ${input.awayTeam}.`,
            `Odds (decimal): ${odds}.`,
            `${form}.`,
            `${h2h}.`,
            `${injuries}.`,
            'Return JSON with fields: home, draw, away, recommended, reason.',
            'Example: {"home":0.55,"draw":0.25,"away":0.20,"recommended":"HOME","reason":"..."}',
        ].join(' ');
    }

    private parsePrediction(content?: string | null): LlmPrediction | null {
        if (!content) return null;
        const jsonText = this.extractJson(content);
        if (!jsonText) return null;

        try {
            const parsed = JSON.parse(jsonText) as LlmPrediction;
            if (!parsed || !Number.isFinite(parsed.home) || !Number.isFinite(parsed.draw) || !Number.isFinite(parsed.away)) {
                return null;
            }
            const sum = parsed.home + parsed.draw + parsed.away;
            if (sum <= 0) return null;
            return {
                home: parsed.home / sum,
                draw: parsed.draw / sum,
                away: parsed.away / sum,
                recommended: parsed.recommended,
                reason: parsed.reason || '',
            };
        } catch (error) {
            this.logger.warn(`Failed to parse LLM response: ${error}`);
            return null;
        }
    }

    private extractJson(text: string): string | null {
        const trimmed = text.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) return null;
        return trimmed.slice(start, end + 1);
    }
}
