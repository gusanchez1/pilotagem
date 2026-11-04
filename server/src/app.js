import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { sanitizeBody } from './middlewares/sanitize.js';
import api from './routes/index.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 'loopback');
  app.set('query parser', 'simple'); // sem objetos aninhados na query string (evita injeção de operadores)
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          frameSrc: ["'self'", 'blob:'],
          objectSrc: ["'self'", 'blob:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.use(
    cors({
      origin: [env.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: false,
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(sanitizeBody);

  app.use('/api', api);
  app.use('/api', notFoundHandler);

  // Modo apresentação: a própria API serve o frontend compilado (npm run demo)
  if (existsSync(join(env.clientDist, 'index.html'))) {
    app.use(express.static(env.clientDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(env.clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
