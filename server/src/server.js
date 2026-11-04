import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { User } from './models/index.js';

async function main() {
  await connectDatabase();
  const users = await User.estimatedDocumentCount();

  const app = createApp();
  // No Express 5 o callback do listen também recebe erros (ex.: porta em uso)
  app.listen(env.port, (err) => {
    if (err) {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n✖ A porta ${env.port} já está em uso. Feche o outro processo ou altere PORT em server/.env.\n`);
      } else {
        console.error(`\n✖ Não foi possível iniciar a API: ${err.message}\n`);
      }
      process.exit(1);
    }
    const servesClient = existsSync(join(env.clientDist, 'index.html'));
    console.log('');
    console.log('  ▌PILOTAGEM — API em execução');
    console.log(`  ▌API:        http://localhost:${env.port}/api`);
    if (servesClient) console.log(`  ▌Aplicação:  http://localhost:${env.port}  (frontend compilado)`);
    console.log(`  ▌MongoDB:    conectado (${env.mongoUri.replace(/\/\/.*@/, '//***@')})`);
    if (users === 0) console.log('  ▌Atenção:    banco vazio — execute `npm run seed` para carregar os dados de demonstração');
    console.log('');
  });
}

main().catch((err) => {
  console.error(`\n✖ ${err.message}\n`);
  process.exit(1);
});
