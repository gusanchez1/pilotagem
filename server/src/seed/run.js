#!/usr/bin/env node
/**
 * Restaura os dados de demonstração.
 *
 *   npm run seed            (na raiz do projeto)
 *
 * ATENÇÃO: apaga e recria todos os dados do banco configurado em MONGODB_URI.
 */
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { DEMO_PASSWORDS, USERS } from './data.js';
import { seedDatabase } from './seed.js';

const LABEL = { admin: 'Administrador', recepcao: 'Recepção', financeiro: 'Financeiro', instrutor: 'Instrutor' };

try {
  console.log('\nPILOTAGEM — restaurando dados de demonstração');
  console.log(`  Banco: ${env.mongoUri.replace(/\/\/.*@/, '//***@')}\n`);
  await connectDatabase();
  const started = Date.now();
  await seedDatabase();
  console.log(`\n✔ Concluído em ${((Date.now() - started) / 1000).toFixed(1)} s\n`);
  console.log('  Contas de demonstração:');
  for (const u of USERS) {
    console.log(`   ${LABEL[u.role].padEnd(14)} ${u.email.padEnd(30)} ${DEMO_PASSWORDS[u.role]}`);
  }
  console.log('');
  await disconnectDatabase();
} catch (err) {
  console.error(`\n✖ ${err.message}\n`);
  process.exit(1);
}
