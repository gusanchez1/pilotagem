#!/usr/bin/env node
/**
 * Diagnóstico do ambiente — útil no dia da apresentação.
 *
 *   npm run doctor
 *
 * Verifica: versão do Node, arquivos .env, dependências instaladas, conexão com o MongoDB
 * e se o banco já possui os dados de demonstração.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let problems = 0;

const ok = (msg) => console.log(`  ✔ ${msg}`);
const fail = (msg, tip) => {
  problems += 1;
  console.log(`  ✖ ${msg}`);
  if (tip) console.log(`      → ${tip}`);
};

console.log('\nPILOTAGEM — diagnóstico do ambiente\n');

// 1. Node
const [major, minor] = process.versions.node.split('.').map(Number);
if (major > 20 || (major === 20 && minor >= 19)) ok(`Node.js ${process.versions.node}`);
else fail(`Node.js ${process.versions.node} é antigo`, 'Instale o Node.js 22 LTS (ou superior) em https://nodejs.org');

// 2. .env
for (const folder of ['server', 'client']) {
  if (existsSync(join(root, folder, '.env'))) ok(`${folder}/.env encontrado`);
  else fail(`${folder}/.env ausente`, 'Execute: npm run setup');
}

// 3. Dependências
if (existsSync(join(root, 'node_modules', 'express')) && existsSync(join(root, 'node_modules', 'react'))) {
  ok('Dependências instaladas');
} else {
  fail('Dependências não instaladas', 'Execute: npm install (na raiz do projeto)');
}

// 4. MongoDB
function readEnv(file) {
  const env = {};
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = readEnv(join(root, 'server', '.env'));
const uri = env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pilotagem';

try {
  const { default: mongoose } = await import('mongoose');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
  ok(`MongoDB conectado (${uri.replace(/\/\/.*@/, '//***@')})`);
  const users = await mongoose.connection.db.collection('users').countDocuments();
  const appointments = await mongoose.connection.db.collection('appointments').countDocuments();
  if (users > 0) ok(`Banco com dados: ${users} usuários, ${appointments} agendamentos`);
  else fail('Banco vazio (sem dados de demonstração)', 'Execute: npm run seed');
  await mongoose.disconnect();
} catch (err) {
  if (err.code === 'ERR_MODULE_NOT_FOUND') {
    fail('Não foi possível testar o MongoDB (dependências ausentes)', 'Execute: npm install');
  } else {
    fail(`MongoDB indisponível em ${uri}`, 'Inicie o serviço do MongoDB (veja LOCAL_SETUP.md → Troubleshooting)');
  }
}

console.log(problems ? `\n${problems} problema(s) encontrado(s).\n` : '\nTudo pronto! Execute: npm run dev\n');
process.exit(problems ? 1 : 0);
