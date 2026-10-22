import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8');
const url = source.match(/SUPABASE_URL = '([^']+)'/)[1];
const key = source.match(/PUBLIC_KEY = '([^']+)'/)[1];
const request = async (path, options = {}) => {
  const response = await fetch(url + path, {
    ...options, headers: { apikey: key, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000)
  });
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  return response.json();
};
await request('/auth/v1/health');
const stats = await request('/rest/v1/rpc/zuzucord_public_stats', { method: 'POST', body: '{}' });
assert.equal(typeof stats.total_users, 'number');
assert.equal(typeof stats.total_servers, 'number');
// Anonymous requests must never reveal private messages or role grants.
for (const table of ['zuzucord_direct_messages', 'zuzucord_user_roles']) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key }, signal: AbortSignal.timeout(15000)
  });
  if (response.ok) assert.deepEqual(await response.json(), [], `${table} exposed anonymous data`);
  else assert.ok([401, 403].includes(response.status), `${table}: unexpected HTTP ${response.status}`);
}
console.log('Supabase Auth, public stats, and anonymous private-data access checks passed.');
