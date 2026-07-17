import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const missing = ['THE_ODDS_API_KEY', 'API_FOOTBALL_KEY'].filter(
        key => !process.env[key]?.trim(),
    );
    if (missing.length > 0) {
        console.error(`Missing required environment variables: ${missing.join(', ')}`);
        console.error('Set them in Render → Environment, then redeploy.');
        process.exit(1);
    }

    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log'],
    });

    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);

    app.enableCors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
                callback(null, true);
                return;
            }
            callback(null, allowedOrigins);
        },
        credentials: true,
    });

    const port = Number(process.env.PORT) || 3001;
    await app.listen(port, '0.0.0.0');
    console.log(`API listening on port ${port}`);
}

bootstrap().catch((error) => {
    console.error('Failed to start API:', error);
    process.exit(1);
});
