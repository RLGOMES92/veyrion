import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('PostCSS fica fixado em versão corrigida e o lockfile acompanha o override', async () => {
  const pkg = JSON.parse(await read('package.json'));
  const lock = JSON.parse(await read('package-lock.json'));
  assert.equal(pkg.overrides?.postcss, '8.5.32');
  assert.equal(lock.packages?.['node_modules/postcss']?.version, '8.5.32');
});

test('Next.js publica cabeçalhos HTTP de proteção', async () => {
  const config = await read('next.config.ts');
  for (const header of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Strict-Transport-Security']) {
    assert.ok(config.includes(header), `cabeçalho ausente: ${header}`);
  }
  assert.match(config, /poweredByHeader:\s*false/);
});

test('Git ignora segredos de ambiente e mantém apenas o modelo de exemplo', async () => {
  const ignore = await read('.gitignore');
  assert.match(ignore, /^\.env\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);
});

test('prebuild gera lockfile com dependências opcionais e executa testes antes da compilação', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.ok(pkg.scripts?.prebuild?.includes('npm install --package-lock-only --include=optional'), 'prebuild não gera lockfile com dependências opcionais');
  assert.ok(pkg.scripts?.prebuild?.includes('npm test'), 'prebuild não executa a suíte estrutural');
  assert.equal(pkg.scripts?.build, 'tsc --noEmit && next build');
});

test('migration bloqueia autoelevação e alteração da identidade do vínculo', async () => {
  const migration = await read('supabase/migrations/008_security_role_self_escalation.sql');
  assert.match(migration, /user_id\s*<>\s*auth\.uid\(\)/);
  assert.match(migration, /prevent_veyrion_membership_identity_change/);
  assert.match(migration, /new\.organization_id\s+is distinct from old\.organization_id/i);
  assert.match(migration, /new\.user_id\s+is distinct from old\.user_id/i);
});
