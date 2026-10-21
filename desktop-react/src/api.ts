import { createClient, type Session } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://wfqudstuncdldsvxqveu.supabase.co';
export const PUBLIC_KEY = 'sb_publishable_LsAzcgmeAp3fBCtdU6eQzw_u5PPJjar';

// The OS encrypts authentication state through Electron safeStorage.
// In browser-only development it stays in memory and disappears on reload.
const transient = new Map<string, string>();
const sessionStorageAdapter = {
  getItem: async (key: string) => window.zuzuDesktop
    ? window.zuzuDesktop.secureGet(key) : transient.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    if (window.zuzuDesktop) await window.zuzuDesktop.secureSet(key, value);
    else transient.set(key, value);
  },
  removeItem: async (key: string) => {
    if (window.zuzuDesktop) await window.zuzuDesktop.secureRemove(key);
    else transient.delete(key);
  }
};

export const client = createClient(SUPABASE_URL, PUBLIC_KEY, {
  auth: {
    persistSession: true, autoRefreshToken: true,
    detectSessionInUrl: false, storage: sessionStorageAdapter
  }
});

export type Server = { id: string; name: string; description: string; owner_id: string };
export type Channel = { id: string; name: string; description: string; server_id?: string };
export type ChatMessage = {
  id: string; author_id: string; content: string; created_at: string; bot_name?: string | null
};
export type FriendRequest = {
  id: string; from_user: string; to_user: string; status: 'pending' | 'accepted' | 'declined'
};
export type Member = { user_id: string; username: string; role: 'owner' | 'admin' | 'member'; joined_at: string };
export type Profile = { user_id: string; display_name: string; status_text: string; avatar_url?: string | null };
export type MessageDM = {
  id: string; sender_id: string; recipient_id: string; content: string; created_at: string
};
export type Appearance = {
  theme: 'oled' | 'graphite' | 'midnight';
  accent: string;
  gradient_enabled: boolean;
  gradient_start: string;
  gradient_end: string;
  glass_strength: number;
  motion_enabled: boolean;
  compact: boolean;
  sync_enabled: boolean
};
export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'oled', accent: '#a978ff',
  gradient_enabled: true, gradient_start: '#25083f', gradient_end: '#09050f',
  glass_strength: 64, motion_enabled: true, compact: false, sync_enabled: false
};

const hex = (value: unknown, fallback: string): string =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
export function validateAppearance(input: unknown): Appearance {
  const v = input && typeof input === 'object' ? input as Partial<Appearance> : {};
  return {
    theme: v.theme === 'graphite' || v.theme === 'midnight' ? v.theme : 'oled',
    accent: hex(v.accent, DEFAULT_APPEARANCE.accent),
    gradient_enabled: v.gradient_enabled !== false,
    gradient_start: hex(v.gradient_start, DEFAULT_APPEARANCE.gradient_start),
    gradient_end: hex(v.gradient_end, DEFAULT_APPEARANCE.gradient_end),
    glass_strength: Math.max(0, Math.min(100, Number(v.glass_strength ?? 64) || 0)),
    motion_enabled: v.motion_enabled !== false,
    compact: v.compact === true,
    sync_enabled: v.sync_enabled === true
  };
}
const SETTINGS_KEY = 'zuzucord_react_appearance_v1';
export function getLocalAppearance(): Appearance {
  try { return validateAppearance(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); }
  catch { return DEFAULT_APPEARANCE; }
}
export function saveLocalAppearance(value: Appearance): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(validateAppearance(value)));
}

export function emailForLogin(value: string): string {
  const id = value.trim().toLowerCase();
  const alias = id.endsWith('@zuzucord.com') ? id.slice(0, -'@zuzucord.com'.length) : id;
  if (/^[a-z0-9_]{3,24}$/.test(alias)) return alias + '@users.zuzucord.invalid';
  if (id.includes('@') && !id.endsWith('@zuzucord.com')) return id;
  throw Error('Use a username, username@zuzucord.com, or an existing account email.');
}
export function readableUser(email?: string): string {
  if (!email) return 'ZuzuCord member';
  return email.endsWith('@users.zuzucord.invalid')
    ? email.slice(0, -'@users.zuzucord.invalid'.length) + '@zuzucord.com'
    : email;
}
export async function registerUsername(username: string, password: string): Promise<void> {
  const id = username.trim().toLowerCase().replace(/@zuzucord\.com$/,'');
  if (!/^[a-z0-9_]{3,24}$/.test(id)) throw Error('Use 3–24 lowercase letters, numbers, or underscores.');
  if (password.length < 10 || password.length > 128) throw Error('Use a password of 10–128 characters.');
  const response = await fetch(SUPABASE_URL + '/functions/v1/zuzucord-register', {
    method: 'POST', headers: { apikey: PUBLIC_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: id, password })
  });
  const result: { success?: boolean; error?: string } = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw Error(result.error || 'Account registration could not complete.');
}

function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw Error(result.error.message);
  return result.data;
}

export async function ensureAccount(session: Session): Promise<string> {
  const userId = session.user.id;
  const existing = checked(await client.from('zuzucord_accounts')
    .select('username').eq('user_id', userId).maybeSingle());
  if (existing?.username) return existing.username as string;
  const email = session.user.email || '';
  const username = email.endsWith('@users.zuzucord.invalid')
    ? email.split('@')[0] : 'member_' + userId.replaceAll('-', '').slice(0, 16);
  // Existing email-auth users may need their one-time ZuzuCord membership.
  checked(await client.from('zuzucord_accounts').upsert(
    { user_id: userId, username }, { onConflict: 'user_id', ignoreDuplicates: true }));
  return username;
}
export const appApi = {
  async presenceHeartbeat(): Promise<void> {
    checked(await client.rpc('zuzucord_presence_heartbeat'));
  },
  async onlineFriendIds(friendIds: string[]): Promise<string[]> {
    if (!friendIds.length) return [];
    const rows = checked(await client.from('zuzucord_friend_presence')
      .select('user_id,last_seen_at').in('user_id', friendIds)) || [];
    const cutoff = Date.now() - 135000;
    return rows.filter(row => new Date(row.last_seen_at).getTime() >= cutoff)
      .map(row => row.user_id as string);
  },
  async getServers(): Promise<Server[]> {
    return checked(await client.from('zuzucord_servers')
      .select('id,name,description,owner_id').order('created_at', { ascending: false })) || [];
  },
  async getChannels(serverId?: string): Promise<Channel[]> {
    const query = serverId
      ? client.from('zuzucord_server_channels')
        .select('id,name,description,server_id').eq('server_id', serverId).order('position')
      : client.from('zuzucord_rooms')
        .select('id,name,description').eq('is_public', true).order('name');
    return checked(await query) || [];
  },
  async getMessages(channelId: string, server: boolean): Promise<ChatMessage[]> {
    const table = server ? 'zuzucord_server_messages' : 'zuzucord_messages';
    const column = server ? 'channel_id' : 'room_id';
    const fields = server ? 'id,author_id,content,created_at,bot_name' : 'id,author_id,content,created_at';
    const list = checked(await client.from(table).select(fields)
      .eq(column, channelId).order('created_at', { ascending: false }).limit(100));
    return (list || []).reverse() as unknown as ChatMessage[];
  },
  async sendMessage(channelId: string, server: boolean, userId: string, content: string): Promise<void> {
    const message = content.trim();
    if (message.length < 1 || message.length > 2000) throw Error('Messages must be 1–2000 characters.');
    if (server && message.startsWith('/')) {
      checked(await client.rpc('zuzucord_run_bot_command', { p_channel: channelId, p_command: message }));
      return;
    }
    const table = server ? 'zuzucord_server_messages' : 'zuzucord_messages';
    checked(await client.from(table).insert(
      server ? { channel_id: channelId, author_id: userId, content: message }
             : { room_id: channelId, author_id: userId, content: message }
    ));
  },
  createServer: async (name: string): Promise<string> =>
    checked(await client.rpc('zuzucord_create_server', { p_name: name.trim(), p_description: '' })),
  joinServer: async (code: string): Promise<string> =>
    checked(await client.rpc('zuzucord_join_server', { p_invite: code.trim().toLowerCase() })),
  createChannel: async (serverId: string, name: string): Promise<string> =>
    checked(await client.rpc('zuzucord_create_channel', { p_server: serverId, p_name: name.trim().toLowerCase() })),
  serverInvite: async (serverId: string): Promise<string | null> =>
    checked(await client.rpc('zuzucord_server_invite', { p_server: serverId })),
  members: async (serverId: string): Promise<Member[]> =>
    checked(await client.rpc('zuzucord_list_server_members', { p_server: serverId })) || [],
  changeRole: async (serverId: string, userId: string, role: string) =>
    checked(await client.rpc('zuzucord_change_member_role', { p_server: serverId, p_target: userId, p_role: role })),
  removeMember: async (serverId: string, userId: string) =>
    checked(await client.rpc('zuzucord_remove_server_member', { p_server: serverId, p_target: userId })),
  getFriends: async (): Promise<FriendRequest[]> =>
    checked(await client.from('zuzucord_friend_requests').select('id,from_user,to_user,status')
      .order('created_at', { ascending: false })) || [],
  friendName: async (userId: string): Promise<string> =>
    checked(await client.rpc('zuzucord_friend_username', { p_target: userId })) || userId.slice(0, 8),
  findUser: async (username: string): Promise<{ user_id: string; username: string } | null> => {
    const users = checked(await client.rpc('zuzucord_find_username', { p_username: username.trim().toLowerCase() }));
    return Array.isArray(users) && users.length ? users[0] : null;
  },
  friendRequest: async (from: string, to: string): Promise<void> => {
    checked(await client.from('zuzucord_friend_requests')
      .insert({ from_user: from, to_user: to, status: 'pending' }));
  },
  respondFriend: async (requestId: string, accept: boolean): Promise<void> => {
    checked(await client.from('zuzucord_friend_requests')
      .update({ status: accept ? 'accepted' : 'declined' }).eq('id', requestId).eq('status', 'pending'));
  },
  getDMs: async (me: string, friend: string): Promise<MessageDM[]> => {
    const rows = checked(await client.from('zuzucord_direct_messages')
      .select('id,sender_id,recipient_id,content,created_at')
      .or(`and(sender_id.eq.${me},recipient_id.eq.${friend}),and(sender_id.eq.${friend},recipient_id.eq.${me})`)
      .order('created_at', { ascending: false }).limit(100));
    return (rows || []).reverse() as MessageDM[];
  },
  sendDM: async (me: string, friend: string, message: string): Promise<void> => {
    checked(await client.from('zuzucord_direct_messages')
      .insert({ sender_id: me, recipient_id: friend, content: message.trim() }));
  },
  getProfile: async (userId: string): Promise<Profile | null> =>
    checked(await client.from('zuzucord_profiles')
      .select('user_id,display_name,status_text,avatar_url').eq('user_id', userId).maybeSingle()),
  saveProfile: async (userId: string, displayName: string, statusText: string): Promise<void> => {
    checked(await client.from('zuzucord_profiles').upsert(
      { user_id: userId, display_name: displayName.slice(0, 40), status_text: statusText.slice(0, 120) },
      { onConflict: 'user_id' }));
  },
  betaEligible: async (): Promise<boolean> =>
    checked(await client.rpc('zuzucord_is_beta_tester')) === true,
  getBeta: async (userId: string): Promise<Record<string, unknown> | null> =>
    checked(await client.from('zuzucord_beta_sync').select('*').eq('user_id', userId).maybeSingle()),
  saveBeta: async (userId: string, theme: Appearance, serverId: string | null): Promise<void> => {
    checked(await client.from('zuzucord_beta_sync').upsert({
      user_id: userId,
      theme: theme.theme, accent: theme.accent,
      gradient_enabled: theme.gradient_enabled,
      gradient_start: theme.gradient_start, gradient_end: theme.gradient_end,
      glass_strength: theme.glass_strength, motion_enabled: theme.motion_enabled,
      sync_enabled: theme.sync_enabled, last_server_id: serverId,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' }));
  },
  getStats: async () => checked(await client.rpc('zuzucord_public_stats')) as {
    total_users: number; created_today: number; banned_users: number; total_servers: number
  }
};
