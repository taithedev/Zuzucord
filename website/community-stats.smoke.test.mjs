import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

for (const site of ['website', 'beta-website']) {
  test(site + ': real Supabase counters load even if GitHub API fails', async () => {
    const source = readFileSync(new URL('../' + site + '/app.js', import.meta.url), 'utf8');
    const elements = new Map();
    const calls = [];
    let stats = {
      total_users: 17, created_today: 4, banned_users: 2, banned_today: 1,
      total_messages: 76, total_servers: 5
    };
    const get = id => {
      if (id === 'register-form' || id === 'interactive-preview') return null;
      if (!elements.has(id)) elements.set(id, {
        textContent: '', href: '', disabled: false,
        addEventListener(event, cb) { this[event] = cb; }
      });
      return elements.get(id);
    };
    const document = {
      getElementById: get,
      addEventListener(type, fn) { if (type === 'DOMContentLoaded') this.ready = fn; }
    };
    const fetch = async (url) => {
      calls.push(url);
      if (!url.includes('/rpc/zuzucord_public_stats')) throw new Error('GitHub unavailable');
      return { ok: true, json: async () => stats };
    };
    const context = vm.createContext({
      document, fetch, console,
      window: { setInterval(fn, delay) { assert.equal(delay, 60000); this.poll = fn; } }
    });
    new vm.Script(source).runInContext(context);
    document.ready();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(get('community-users').textContent, '17');
    assert.equal(get('community-today').textContent, '4');
    assert.equal(get('community-banned').textContent, '2');
    assert.equal(get('community-banned-today').textContent, '1');
    assert.equal(get('community-messages').textContent, '76');
    assert.equal(get('community-servers').textContent, '5');
    assert.match(get('community-updated').textContent, /Supabase database/);
    assert.match(get('updated-at').textContent, /GitHub data unavailable/);

    // The community polling action must request another DB read independent
    // of GitHub metrics and should never claim made-up counts.
    stats = { ...stats, total_users: 19, banned_users: 3, created_today: 6 };
    await context.window.poll();
    assert.equal(get('community-users').textContent, '19');
    assert.equal(get('community-banned').textContent, '3');
    assert.equal(get('community-today').textContent, '6');
    assert.ok(calls.filter(x => x.includes('/rpc/zuzucord_public_stats')).length >= 2);
  });
}
