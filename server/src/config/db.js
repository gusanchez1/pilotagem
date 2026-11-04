import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDatabase(uri = env.mongoUri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    return mongoose.connection;
  } catch (err) {
    const safeUri = uri.replace(/\/\/.*@/, '//***@');
    const error = new Error(
      `Não foi possível conectar ao MongoDB em ${safeUri}.\n` +
        '  → Verifique se o serviço do MongoDB está em execução (veja LOCAL_SETUP.md → Troubleshooting).\n' +
        `  → Detalhe: ${err.message}`,
    );
    error.cause = err;
    throw error;
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
