import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';

const clientSource = readFileSync(new URL('./sync.js', import.meta.url), 'utf8');
const SERVER = '11111111-2222-3333-4444-555555555555';
const CREATED = '66666666-7777-8888-9999-aaaaaaaaaaaa';
const USER = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

function fixture({ approved = true } = {}) {
  const controls = new Map();
  const requests = [];
  const responses = new Map();
  const node = name => {
    if (controls.has(name)) return controls.get(name);
    const callbacks = {};
    const n = {
      value: '', textContent: '', hidden: false, disabled: false, checked: false,
      options: [], selectedIndex: 0, style: { setProperty() {} },
      classList: { toggle() {} },
      setAttribute() {},
      replaceChildren(...entries) { this.options = [...entries]; },
      add(option) { this.options.push(option); },
      reset() { this.value = ''; },
      addEventListener(name, cb) { callbacks[name] = cb; },
      async fire(name) { if (!callbacks[name]) throw new Error('Missing callback: ' + this.id + ' ' + name); return callbacks[name]({ preventDefault() {} }); },
      id: name
    };
    controls.set(name, n);
    return n;
  };
  const document = {
    addEventListener(event, cb) { if (event === 'DOMContentLoaded') this.ready = cb; },
    getElementById: node
  };
  node('login-id').value = 'tester@zuzucord.com';
  node('login-secret').value = 'correct-horse-test';
  node('theme-choice').value = 'oled';
  node('accent-choice').value = '#c9c9d2';
  node('active-server').value = '';

  const defaultTheme = { theme: 'graphite', accent: '#9292aa', sync_enabled: true, last_server_id: SERVER };
  let currentServers = [{ id: SERVER, name: 'Team Space' }];
  const fetch = async (url, init = {}) => {
    const path = url.split('.co')[1] || url;
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ path, body, headers: init.headers });
    let data;
    if (path.startsWith('/auth/v1/token?grant_type=password'))
      data = { access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user: { id: USER } };
    else if (path.includes('/rpc/zuzucord_is_beta_tester'))
      data = approved;
    else if (path.includes('zuzucord_servers?select='))
      data = currentServers;
    else if (path.includes('zuzucord_beta_sync?select='))
      data = [defaultTheme];
    else if (path.includes('zuzucord_beta_sync?on_conflict=')) {
      assert.equal(init.headers.Authorization, 'Bearer access');
      assert.equal(body.user_id, USER);
      data = null;
    } else if (path.includes('/rpc/zuzucord_create_server')) {
      assert.equal(body.p_name, 'My new server');
      currentServers = [...currentServers, { id: CREATED, name: 'My new server' }];
      data = CREATED;
    } else if (path.includes('/rpc/zuzucord_join_server')) data = SERVER;
    else if (path.includes('/rpc/zuzucord_server_invite')) data = 'aabbccddeeff1234';
    else throw new Error('Unexpected request ' + path);
    return { ok: true, status: 200, text: async () => JSON.stringify(data), json: async () => data };
  };
  const ctx = createContext({
    document, fetch, console, Date, Promise, JSON, String, Number,
    Option: class { constructor(text, value) { this.text = text; this.value = value; } },
    setTimeout
  });
  new Script(clientSource).runInContext(ctx);
  document.ready();
  return { controls, node, requests, document };
}

test('unapproved accounts cannot see beta controls', async () => {
  const app = fixture({ approved: false });
  await app.node('signin-form').fire('submit');
  assert.equal(app.node('sync-panel').hidden, true);
  assert.match(app.node('sync-status').textContent, /not currently approved/i);
  assert.equal(app.requests.filter(r => r.path.includes('zuzucord_beta_sync')).length, 0);
});

test('approved user loads saved theme and member-only server list', async () => {
  const app = fixture();
  await app.node('signin-form').fire('submit');
  assert.equal(app.node('sync-panel').hidden, false);
  assert.equal(app.node('theme-choice').value, 'graphite');
  assert.equal(app.node('accent-choice').value, '#9292aa');
  assert.equal(app.node('active-server').value, SERVER);
  assert.equal(app.node('active-server').options.length, 2);
  assert.ok(app.requests.some(r => r.path.includes('/rpc/zuzucord_is_beta_tester')));
});

test('approved user saves server and theme, and creates an in-app server', async () => {
  const app = fixture();
  await app.node('signin-form').fire('submit');
  await app.node('sync-save').fire('click');
  const saved = app.requests.find(r => r.path.includes('zuzucord_beta_sync?on_conflict='));
  assert.equal(saved.body.last_server_id, SERVER);
  assert.equal(saved.body.sync_enabled, true);
  app.node('server-new-name').value = 'My new server';
  await app.node('server-create').fire('click');
  assert.equal(app.node('active-server').value, CREATED);
  assert.ok(app.requests.some(r => r.path.includes('rpc/zuzucord_create_server')));
});

test('session sign-out removes access to beta tools', async () => {
  const app = fixture();
  await app.node('signin-form').fire('submit');
  await app.node('sync-signout').fire('click');
  assert.equal(app.node('sync-panel').hidden, true);
  assert.equal(app.node('login-panel').hidden, false);
});
