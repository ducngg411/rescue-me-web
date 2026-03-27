import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Chatbot can send extracted video frames as base64 images; raise JSON/body limits.
  app.use(bodyParser.json({ limit: '25mb' }));
  app.use(bodyParser.urlencoded({ limit: '25mb', extended: true }));

  // Enable CORS
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3002', // Thêm port 3002
    ],
    credentials: true,
  });

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  // ─── DEBUG: detect double-response per request ───────────────────────────
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    let sent = false;
    res.json = function (...args) {
      if (sent) {
        console.error(`🔴 DOUBLE-RESPONSE on ${req.method} ${req.url}`);
        console.trace(); // prints stack so we know WHO is sending the 2nd response
        return res; // swallow the second call instead of crashing
      }
      sent = true;
      return originalJson(...args);
    };
    next();
  });
  // ─── END DEBUG ──────────────────────────────────────────────────────────────

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Backend server running on http://localhost:${port}`);
}
bootstrap();
