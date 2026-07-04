import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { logger: false });

    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);

    app.enableCors({
        origin: allowedOrigins,
        credentials: true,
    });

    const port = Number(process.env.PORT) || 3001;
    await app.listen(port, '0.0.0.0');
}
bootstrap();
