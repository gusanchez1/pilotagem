import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: join(serverRoot, '.env'), quiet: true });

const isTest = process.env.NODE_ENV === 'test';

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'sim'].includes(String(value).toLowerCase());
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isTest,
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 4000,
  mongoUri: isTest
    ? process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/pilotagem_test'
    : process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pilotagem',
  jwtSecret: process.env.JWT_SECRET || 'pilotagem-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  allowDemoReset: bool(process.env.ALLOW_DEMO_RESET, true),
  timezone: process.env.APP_TIMEZONE || 'America/Sao_Paulo',
  serverRoot,
  uploadsDir: join(serverRoot, 'uploads'),
  clientDist: join(serverRoot, '..', 'client', 'dist'),
};

if (!process.env.JWT_SECRET && !isTest) {
  console.warn('[env] JWT_SECRET não definido — usando segredo de desenvolvimento. Execute `npm run setup`.');
}
