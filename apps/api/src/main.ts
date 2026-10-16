import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global prefix with health check exclusion
  const apiPrefix = 'api/v1';
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health'],
  });

  // Global DTO Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // CORS Configuration
  const rawOrigins = process.env.CORS_ORIGINS || 'http://localhost:4200,http://127.0.0.1:4200';
  const allowedOrigins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!requestOrigin) return callback(null, true);

      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed === '*') return true;
        return allowed === requestOrigin || requestOrigin.startsWith(allowed);
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked request from origin: ${requestOrigin}`);
        callback(null, false);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ClinicQueue API')
    .setDescription(
      'ClinicQueue REST API & Real-time WebSockets service for DLSU-D clinic queue management',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Port and Listen (0.0.0.0 is mandatory for Render web services)
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const host = '0.0.0.0';

  await app.listen(port, host);

  logger.log(`ClinicQueue API server running on http://${host}:${port}`);
  logger.log(`API Base Route: http://${host}:${port}/${apiPrefix}`);
  logger.log(`Health Check Endpoint: http://${host}:${port}/health`);
  logger.log(`Swagger OpenAPI Documentation: http://${host}:${port}/api/docs`);
  logger.log(`Allowed CORS Origins: ${allowedOrigins.join(', ')}`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during application startup:', err);
  process.exit(1);
});
