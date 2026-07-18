import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

function createPrismaOptions() {
    const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
    if (!tursoUrl) {
        return undefined;
    }

    const libsql = createClient({
        url: tursoUrl,
        authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
    });

    return {
        adapter: new PrismaLibSQL(libsql),
    };
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor() {
        super(createPrismaOptions());
    }

    async onModuleInit() {
        await this.$connect();
        if (process.env.TURSO_DATABASE_URL?.trim()) {
            this.logger.log('Connected to Turso database');
        } else {
            this.logger.log('Connected to local SQLite database');
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
