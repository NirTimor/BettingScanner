import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BettingModule } from './betting/betting.module';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { HealthController } from './health.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ScheduleModule.forRoot(),
        BettingModule,
        AuthModule,
        ProfileModule,
    ],
    controllers: [HealthController],
    providers: [],
    exports: [],
})
export class AppModule { }
