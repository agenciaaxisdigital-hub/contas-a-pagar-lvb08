import { createReadStream, readFileSync } from 'fs';

const SUPABASE_URL = 'https://yvdfdmyusdhgtzfguxbj.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2ZGZkbXl1c2RoZ3R6Zmd1eGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTg4MzksImV4cCI6MjA4OTA3NDgzOX0.-xSNbj5kLibkhJoXmOXjfmYPKBB-gqasQgy322Kk-n4';

async function getToken() {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/login-por-nome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ nome: 'Deocleciano', senha: 'Sarelli2020' })
  });
  const d = await r.json();
  if (!d.session) throw new Error('Login failed: ' + JSON.stringify(d));
  return d.session.access_token;
}

async function createBucket(token) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'empresas', name: 'empresas', public: true, allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'] })
  });
  const d = await r.json();
  console.log('Bucket:', r.status, d.message ?? d.name ?? JSON.stringify(d));
}

async function uploadLogo(token, filePath, name) {
  const data = readFileSync(filePath);
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/empresas/logos/${name}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'image/png', 'x-upsert': 'true' },
    body: data
  });
  const d = await r.json();
  if (r.status >= 300) throw new Error(`Upload failed ${name}: ${JSON.stringify(d)}`);
  const url = `${SUPABASE_URL}/storage/v1/object/public/empresas/logos/${name}`;
  console.log(`Logo uploaded: ${name} → ${url}`);
  return url;
}

async function patchEmpresa(token, id, updates) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/empresas?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(updates)
  });
  const d = await r.json();
  console.log(`Patch ${id}:`, JSON.stringify(d).substring(0, 100));
  return d;
}

async function insertEmpresa(token, nome, cnpj, logoUrl, corFundo) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/empresas`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ nome, cnpj, logo_url: logoUrl, cor_fundo: corFundo })
  });
  const d = await r.json();
  console.log(`Insert "${nome}":`, r.status, JSON.stringify(d).substring(0, 100));
  return d;
}

(async () => {
  const token = await getToken();
  console.log('✓ Login OK');

  await createBucket(token);

  const assetBase = 'C:/Users/Gusta/Desktop/app top 100/top100fmv1.0/src/assets/';
  const sarelliUrl = await uploadLogo(token, `${assetBase}dra-fernanda-sarelli.png`, 'dra-fernanda-sarelli.png');
  const axisUrl    = await uploadLogo(token, `${assetBase}axis-digital.png`, 'axis-digital.png');
  const top100Url  = await uploadLogo(token, 'C:/Users/Gusta/Desktop/top 100 fm/logo top100fm.png', 'top100-fm.png');

  // Update Dra. Fernanda Sarelli (existing empresa)
  await patchEmpresa(token, 'c7706756-52d9-4eca-bbd8-82b36421e995', {
    logo_url: sarelliUrl,
    cor_fundo: '#FFFFFF'
  });

  // Create Agência Axis
  await insertEmpresa(token, 'Agência Axis', null, axisUrl, '#FFFFFF');

  // Create Rádio Top 100 FM
  await insertEmpresa(token, 'Rádio Top 100 FM', null, top100Url, '#000000');

  console.log('\n✓ DONE — 3 empresas criadas/atualizadas');
})().catch(e => { console.error('✗ ERRO:', e.message); process.exit(1); });
