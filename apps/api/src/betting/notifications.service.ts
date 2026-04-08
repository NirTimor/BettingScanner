import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private readonly telegramToken: string;
    private readonly telegramChatId: string;
    private readonly resendKey: string;
    private readonly emailFrom: string;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {
        this.telegramToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
        this.telegramChatId = this.configService.get<string>('TELEGRAM_CHAT_ID') || '';
        this.resendKey = this.configService.get<string>('RESEND_API_KEY') || '';
        this.emailFrom = this.configService.get<string>('EMAIL_FROM') || '';
    }

    async sendDailyUpdates(date?: string) {
        const { startOfDay, endOfDay } = this.getDayBounds(date);
        const latestScanForDay = await this.prisma.bettingScan.findFirst({
            where: {
                scanDate: { gte: startOfDay, lt: endOfDay },
            },
            orderBy: { createdAt: 'desc' },
        });

        const recommendations = await this.prisma.recommendation.findMany({
            where: latestScanForDay
                ? { scanId: latestScanForDay.id }
                : { commenceTime: { gte: startOfDay, lt: endOfDay } },
            orderBy: { commenceTime: 'asc' },
        });

        const byEvent = new Map<string, typeof recommendations[number]>();
        for (const rec of recommendations) {
            const existing = byEvent.get(rec.eventTitle);
            const currentScore = rec.confidenceScore ?? 0;
            const existingScore = existing?.confidenceScore ?? 0;
            if (!existing || currentScore > existingScore) {
                byEvent.set(rec.eventTitle, rec);
            }
        }

        const picks = Array.from(byEvent.values());
        const message = this.buildTelegramMessage(picks);
        const emailHtml = this.buildEmailHtml(picks);

        const telegramResult = await this.sendTelegram(message);
        const emailResult = await this.sendEmailToUsers(emailHtml);

        return {
            total: picks.length,
            telegram: telegramResult,
            email: emailResult,
        };
    }

    private buildTelegramMessage(recs: Array<{ eventTitle: string; selection: string; odds: any; confidenceScore?: number | null; sportKey: string }>) {
        if (recs.length === 0) return 'No recommendations today.';
        const lines = recs.map((rec) => {
            const odds = Number(rec.odds || 0).toFixed(2);
            const confidence = rec.confidenceScore ?? 0;
            return `• ${rec.eventTitle} — ${rec.selection} @ ${odds} (${confidence}%)`;
        });
        return `Today’s recommendations:\n${lines.join('\n')}`;
    }

    private buildEmailHtml(recs: Array<{ eventTitle: string; selection: string; odds: any; confidenceScore?: number | null }>) {
        if (recs.length === 0) {
            return `<p>No recommendations today.</p>`;
        }
        const items = recs.map((rec) => {
            const odds = Number(rec.odds || 0).toFixed(2);
            const confidence = rec.confidenceScore ?? 0;
            return `<li><strong>${rec.eventTitle}</strong> — ${rec.selection} @ ${odds} (${confidence}%)</li>`;
        }).join('');

        return `
            <h2>Today’s recommendations</h2>
            <ul>${items}</ul>
        `;
    }

    private async sendTelegram(message: string) {
        if (!this.telegramToken || !this.telegramChatId) {
            return { ok: false, skipped: true, reason: 'Missing Telegram config' };
        }
        try {
            const res = await fetch(`https://api.telegram.org/bot${this.telegramToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: this.telegramChatId,
                    text: message,
                    disable_web_page_preview: true,
                }),
            });
            if (!res.ok) {
                const text = await res.text();
                this.logger.error(`Telegram send failed: ${text}`);
                return { ok: false };
            }
            return { ok: true };
        } catch (error) {
            this.logger.error('Telegram send failed', error);
            return { ok: false };
        }
    }

    private async sendEmailToUsers(html: string) {
        if (!this.resendKey || !this.emailFrom) {
            return { ok: false, skipped: true, reason: 'Missing email config' };
        }
        const users = await this.prisma.user.findMany({
            select: { email: true },
        });
        if (users.length === 0) {
            return { ok: false, skipped: true, reason: 'No users' };
        }

        let success = 0;
        for (const user of users) {
            try {
                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${this.resendKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        from: this.emailFrom,
                        to: user.email,
                        subject: 'Today’s betting recommendations',
                        html,
                    }),
                });
                if (res.ok) success += 1;
            } catch (error) {
                this.logger.error('Email send failed', error);
            }
        }

        return { ok: true, sent: success, total: users.length };
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
