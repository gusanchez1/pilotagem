#!/usr/bin/env node
/**
 * Cria os arquivos .env a partir dos modelos (.env.example), caso ainda não existam.
 * Funciona igual no Windows (PowerShell/CMD) e no macOS (Terminal).
 *
 *   npm run setup
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function createEnv(folder, transform = (s) => s) {
  const example = join(root, folder, '.env.example');
  const target = join(root, folder, '.env');
  if (existsSync(target)) {
    console.log(`✔ ${folder}/.env já existe — mantido sem alterações.`);
    return;
  }
  if (!existsSync(example)) {
    console.error(`✖ Modelo ${folder}/.env.example não encontrado.`);
    process.exitCode = 1;
    return;
  }
  writeFileSync(target, transform(readFileSync(example, 'utf8')));
  console.log(`✔ ${folder}/.env criado a partir de ${folder}/.env.example`);
}

createEnv('server', (content) =>
  content.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(32).toString('hex')}`),
);
createEnv('client');

mkdirSync(join(root, 'server', 'uploads'), { recursive: true });
console.log('✔ Pasta server/uploads pronta para comprovantes.');
console.log('\nPróximos passos: npm run seed  →  npm run dev');
