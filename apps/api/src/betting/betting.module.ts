import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TheOddsApiService } from './the-odds-api.service';
import { BettingController } from './betting.controller';
import { ScannerService } from './scanner.service';
import { StatsService } from './stats.service';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from './llm.service';
import { NotificationsService } from './notifications.service';

@Module({
    imports: [ConfigModule],
    controllers: [BettingController],
    providers: [TheOddsApiService, ScannerService, StatsService, PrismaService, LlmService, NotificationsService],
    exports: [TheOddsApiService, ScannerService, StatsService, LlmService, NotificationsService],
})
export class BettingModule { }
