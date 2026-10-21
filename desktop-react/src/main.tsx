import React, { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft, Bell, Bot, Gem, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Copy,
  Crown, Ellipsis, Gift, Globe2, Hash, Heart, Home, LockKeyhole, LogOut, Maximize2,
  MessageCircle, MessagesSquare, Minus, Moon, Palette, PanelRightClose, PanelRightOpen,
  Plus, RefreshCw, Search, Send, Server as ServerIcon, Settings2, Shield,
  ShieldCheck, SlidersHorizontal, Sparkles, Square, UserCheck, UserMinus, UserPlus,
  Users, UsersRound, WandSparkles, X
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import {
  appApi, client, DEFAULT_APPEARANCE, emailForLogin, ensureAccount, getLocalAppearance,
  readableUser, registerUsername, saveLocalAppearance, validateAppearance,
  type Appearance, type Channel, type ChatMessage, type FriendRequest, type Member,
  type MessageDM, type Server, type CustomServerRole, type CustomRoleAssignment
} from './api';
import { ServerRolesEditor } from './ServerRolesEditor';
import { OwnerConsole } from './OwnerConsole';
import { CrystalCenter } from './CrystalCenter';
import './styles.css';

type View = 'friends' | 'channel' | 'dm';
type FriendTab = 'all' | 'pending' | 'online';
type ModalName = 'settings' | 'new-server' | 'join-server' | 'new-channel' | 'add-friend'
  | 'members' | 'invite' | 'profile' | 'bot' | 'announcements' | 'boost' | 'install-bot' | 'roles' | 'owner-tools' | null;
type Friend = { id: string; username: string; status: FriendRequest['status']; outgoing: boolean; requestId: string };
const dateTime = (value: string) => new Date(value).toLocaleString(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
});
const getError = (error: unknown): string => error instanceof Error ? error.message : String(error);
const initials = (name: string): string => name.replace(/^@/, '').split(/[ _-]/)
  .map(word => word[0]).join('').slice(0, 2).toUpperCase() || 'Z';
const colors = ['#a978ff', '#d0d0dc', '#6376f7', '#ed8cbf', '#68cab0', '#f6ad71'];
function IconButton({ label, children, onClick, active, className }: {
  label: string; children: React.ReactNode; onClick?: () => void; active?: boolean; className?: string
}) {
  return <button type="button" title={label} aria-label={label}
    className={'icon-button ' + (active ? 'active ' : '') + (className || '')}
    onClick={onClick}>{children}</button>;
}
function Avatar({ name, size = 'normal', color }: { name: string; size?: 'tiny' | 'normal' | 'large'; color?: string }) {
  const shade = color || '#7b4fa1';
  return <span className={'avatar avatar-' + size} style={{ background: 'linear-gradient(145deg, ' + shade + ', #222033)' }}
    aria-label={name}>{initials(name)}</span>;
}
function Dialog({ heading, subtitle, children, onClose, wide = false }: {
  heading: string; subtitle?: string; children: React.ReactNode; onClose: () => void; wide?: boolean
}) {
  return <div className="modal-shade" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={heading} className={'dialog ' + (wide ? 'dialog-wide' : '')}>
      <div className="dialog-header">
        <div><h2>{heading}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <IconButton label="Close dialog" onClick={onClose}><X size={19} /></IconButton>
      </div>
      {children}
    </section>
  </div>;
}
function Auth({ onSuccess }: { onSuccess: (session: Session) => void }) {
  const [register, setRegister] = useState(false);
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (register) {
        await registerUsername(identity, password);
        setRegister(false); setCreated(true); setPassword('');
      } else {
        const { data, error: authError } = await client.auth.signInWithPassword({
          email: emailForLogin(identity), password
        });
        if (authError) throw authError;
        if (!data.session) throw Error('Sign-in did not return a session.');
        await ensureAccount(data.session);
        onSuccess(data.session);
      }
    } catch (err) { setError(getError(err)); }
    finally { setBusy(false); }
  };
  return <div className="auth-shell">
    <div className="auth-decoration" aria-hidden="true"><div className="auth-glow" /><div className="auth-symbol">Z</div></div>
    <div className="auth-card">
      <div className="auth-mark"><Sparkles size={23} /> ZuzuCord <span>V3</span></div>
      <h1>{register ? 'Join your community.' : 'Welcome back.'}</h1>
      <p className="muted">{register ? 'Create your ZuzuCord ID to get started.' : 'Your servers, your friends, your space.'}</p>
      {created && <p className="success-line"><Check size={16} /> Account created. Sign in using your username and password.</p>}
      <form onSubmit={handleSubmit} className="auth-form">
        <label>Username or ZuzuCord ID</label>
        <input autoFocus required autoComplete="username" value={identity}
          placeholder="username@zuzucord.com" onChange={e => setIdentity(e.target.value)} />
        <label>Password</label>
        <input type="password" autoComplete={register ? 'new-password' : 'current-password'}
          required minLength={register ? 10 : 1} value={password}
          placeholder={register ? '10 or more characters' : 'Enter your password'}
          onChange={e => setPassword(e.target.value)} />
        {register && <p className="tiny muted">Your ZuzuCord ID is a login alias, not a working email inbox. Without a recovery email, password reset by email is unavailable.</p>}
        {error && <p className="error-line" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" disabled={busy} type="submit">
          {busy ? 'Working…' : register ? 'Create account' : 'Sign in'} <ChevronRight size={17} />
        </button>
      </form>
      <p className="auth-switch">{register ? 'Already have an account?' : 'New to ZuzuCord?'}{' '}
        <button className="text-link" onClick={() => { setRegister(!register); setCreated(false); setError(''); }}>
          {register ? 'Sign in' : 'Create an account'}</button></p>
      <p className="tiny muted auth-footer">Independent ZuzuCord community application • Windows desktop</p>
    </div>
  </div>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(true);
  const [acknowledge, setAcknowledge] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>(getLocalAppearance);
  const [modal, setModal] = useState<ModalName>(null);
  const [view, setView] = useState<View>('friends');
  const [tab, setTab] = useState<FriendTab>('all');
  const [query, setQuery] = useState('');
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [directMessages, setDirectMessages] = useState<MessageDM[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [serverCustomRoles, setServerCustomRoles] = useState<CustomServerRole[]>([]);
  const [serverRoleAssignments, setServerRoleAssignments] = useState<CustomRoleAssignment[]>([]);
  const [draft, setDraft] = useState('');
  const [modalValue, setModalValue] = useState('');
  const [modalOther, setModalOther] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [rightPanel, setRightPanel] = useState(true);
  const [beta, setBeta] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [walletCrystals, setWalletCrystals] = useState(0);
  const [legacyCredits, setLegacyCredits] = useState(0);
  const [boostLevel, setBoostLevel] = useState(0);
  const [announcements, setAnnouncements] = useState<{id:string;title:string;content:string;created_at:string}[]>([]);
  const [botApps, setBotApps] = useState<{id:string;name:string;description:string}[]>([]);
  const [installedBots, setInstalledBots] = useState<string[]>([]);
  const [updateRelease, setUpdateRelease] = useState<{tag:string;filename:string;downloadUrl:string;sha256:string|null;notes:string}|null>(null);
  const [updating, setUpdating] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [botEnabled, setBotEnabled] = useState(true);
  const [serverPermissions, setServerPermissions] = useState({manage_channels:false,manage_members:false,manage_bots:false});
  const messagesBottom = useRef<HTMLDivElement | null>(null);
  const quickSearch = useRef<HTMLInputElement | null>(null);
  const loadedBeta = useRef(false);
  const me = session?.user.id || '';
  const currentServer = servers.find(s => s.id === selectedServer) || null;
  const currentChannel = channels.find(ch => ch.id === selectedChannel) || null;
  const currentFriend = friends.find(f => f.id === selectedFriend) || null;
  const isOwner = !!currentServer && currentServer.owner_id === me;
  const currentRole = members.find(m => m.user_id === me)?.role;
  const canCreateChannel = serverPermissions.manage_channels;

  useEffect(() => {
    let alive = true;
    client.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      if (data.session) {
        setSession(data.session);
        try { setUsername(await ensureAccount(data.session)); }
        catch (error) { setStatus('Could not load account: ' + getError(error)); }
      }
      setLoading(false);
    }).catch(error => { setStatus(getError(error)); setLoading(false); });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next);
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    saveLocalAppearance(appearance);
  }, [appearance]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        quickSearch.current?.focus();
      }
      if (event.ctrlKey && event.key === ',') {
        event.preventDefault();
        setModal('settings');
      }
      if (event.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const showError = (error: unknown) => {
    setStatus(getError(error));
  };
  const openModal = (next: ModalName) => {
    setModal(next); setModalValue(''); setModalOther(''); setStatus('');
    if (next === 'boost' && me) {
      void appApi.wallet(me).then(wallet => {
        setWalletCrystals(wallet.crystals);
        setLegacyCredits(wallet.legacyCredits);
      }).catch(showError);
    }
  };

  const loadServers = useCallback(async () => {
    try { setServers(await appApi.getServers()); }
    catch (error) { showError(error); }
  }, []);
  const loadFriends = useCallback(async () => {
    if (!me) return;
    try {
      const requests = await appApi.getFriends();
      const withNames = await Promise.all(requests.filter(r => r.status !== 'declined')
        .map(async r => {
          const outgoing = r.from_user === me;
          const id = outgoing ? r.to_user : r.from_user;
          const username = await appApi.friendName(id).catch(() => id.slice(0, 8));
          return { id, username, status: r.status, outgoing, requestId: r.id } as Friend;
        }));
      setFriends(withNames);
    } catch (error) { showError(error); }
  }, [me]);

  useEffect(() => {
    if (!me) return;
    let live = true;
    Promise.all([loadServers(), loadFriends(), appApi.getProfile(me)]).then(([,,profile]) => {
      if (live && profile) { setProfileName(profile.display_name); setProfileStatus(profile.status_text); }
    }).catch(showError);
    const poll = window.setInterval(() => { void loadServers(); void loadFriends(); }, 24000);
    return () => { live = false; window.clearInterval(poll); };
  }, [me, loadFriends, loadServers]);

  useEffect(() => {
    if (!me) return;
    let active = true;
    const refreshPresence = async () => {
      try {
        await appApi.presenceHeartbeat();
        const accepted = friends.filter(f => f.status === 'accepted').map(f => f.id);
        const online = await appApi.onlineFriendIds(accepted);
        if (active) setOnlineIds(new Set(online));
      } catch { if (active) setOnlineIds(new Set()); }
    };
    void refreshPresence();
    const timer = window.setInterval(refreshPresence, 45000);
    return () => { active = false; window.clearInterval(timer); };
  }, [me, friends]);

  useEffect(() => {
    if (!me || loadedBeta.current) return;
    loadedBeta.current = true;
    Promise.allSettled([
      appApi.myRoles(me),
      appApi.betaEligible(),
      appApi.wallet(me),
      appApi.announcements()
    ]).then(async results => {
      if (results[0].status === 'fulfilled') setUserRoles(results[0].value);
      if (results[1].status === 'fulfilled') setBeta(results[1].value);
      if (results[2].status === 'fulfilled') {
        setWalletCrystals(results[2].value.crystals);
        setLegacyCredits(results[2].value.legacyCredits);
      }
      if (results[3].status === 'fulfilled') setAnnouncements(results[3].value);
      if (!appearance.sync_enabled) return;
      const remote = await appApi.getBeta(me);
      if (remote?.sync_enabled) {
        setAppearance(current => ({ ...validateAppearance(remote), compact: current.compact }));
        if (typeof remote.last_server_id === 'string') {
          setSelectedServer(remote.last_server_id);
          setView('channel');
        }
      }
    }).catch(showError);
  }, [me]);

  useEffect(() => {
    if (!me || !appearance.sync_enabled) return;
    const poll = window.setInterval(async () => {
      try {
        const remote = await appApi.getBeta(me);
        if (!remote?.sync_enabled) return;
        setAppearance(current => {
          const next = validateAppearance(remote);
          const merged = { ...next, compact: current.compact };
          return JSON.stringify(merged) === JSON.stringify(current) ? current : merged;
        });
      } catch { /* Still usable offline if beta sync is temporarily unavailable. */ }
    }, 60000);
    return () => window.clearInterval(poll);
  }, [me, appearance.sync_enabled]);

  useEffect(() => {
    let alive = true;
    setSelectedChannel(null); setChannels([]); setMembers([]);
    if (!me) return;
    appApi.getChannels(selectedServer || undefined).then(async list => {
      if (!alive) return;
      setChannels(list);
      setSelectedChannel(list[0]?.id || null);
      if (selectedServer) {
        const [users, enabled] = await Promise.all([
          appApi.members(selectedServer), client.from('zuzucord_server_bots')
            .select('enabled').eq('server_id', selectedServer).maybeSingle()
        ]);
        if (alive) { setMembers(users); setBotEnabled(enabled.data?.enabled !== false); }
      }
    }).catch(showError);
    return () => { alive = false; };
  }, [selectedServer, me]);

  useEffect(() => {
    if (!selectedServer || !me) { setServerPermissions({manage_channels:false,manage_members:false,manage_bots:false}); return; }
    let alive=true;
    const load=async()=>{
      try {
        const [manage_channels,manage_members,manage_bots] = await Promise.all([
          appApi.canServerAction(selectedServer,'manage_channels'),
          appApi.canServerAction(selectedServer,'manage_members'),
          appApi.canServerAction(selectedServer,'manage_bots')
        ]);
        if(alive)setServerPermissions({manage_channels,manage_members,manage_bots});
      }catch{
        if(alive)setServerPermissions({manage_channels:false,manage_members:false,manage_bots:false});
      }
    };
    void load();
    return ()=>{alive=false;};
  },[selectedServer,me,modal]);

  useEffect(() => {
    if (!selectedServer || !me) {
      setServerCustomRoles([]);setServerRoleAssignments([]);return;
    }
    let active=true;
    Promise.all([appApi.getCustomRoles(selectedServer),appApi.getRoleAssignments(selectedServer)])
      .then(([roles,assignments])=>{
        if(active){setServerCustomRoles(roles);setServerRoleAssignments(assignments);}
      }).catch(()=>{if(active){setServerCustomRoles([]);setServerRoleAssignments([]);}});
    return ()=>{active=false;};
  },[selectedServer,me,modal]);

  const loadMessages = useCallback(async () => {
    if (!selectedChannel || view !== 'channel') return;
    try { setMessages(await appApi.getMessages(selectedChannel, !!selectedServer)); }
    catch (error) { showError(error); }
  }, [selectedChannel, selectedServer, view]);
  const loadDMs = useCallback(async () => {
    if (!me || !selectedFriend || view !== 'dm') return;
    try { setDirectMessages(await appApi.getDMs(me, selectedFriend)); }
    catch (error) { showError(error); }
  }, [selectedFriend, me, view]);

  useEffect(() => {
    if (!session) return;
    if (view === 'channel') { void loadMessages(); const timer = window.setInterval(loadMessages, 7000); return () => window.clearInterval(timer); }
    if (view === 'dm') { void loadDMs(); const timer = window.setInterval(loadDMs, 7000); return () => window.clearInterval(timer); }
  }, [session, view, loadMessages, loadDMs]);
  useEffect(() => { messagesBottom.current?.scrollIntoView({ behavior: 'instant', block: 'end' }); },
    [view, selectedChannel, selectedFriend, messages.length, directMessages.length]);

  const serverSelect = (id: string | null) => {
    setSelectedServer(id); setView('channel'); setSelectedFriend(null); setQuery('');
    if (appearance.sync_enabled && me) {
      void appApi.saveBeta(me, appearance, id).catch(showError);
    }
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !me || busy) return;
    setBusy(true);
    try {
      if (view === 'dm' && selectedFriend) {
        await appApi.sendDM(me, selectedFriend, text);
        await loadDMs();
      } else if (view === 'channel' && selectedChannel) {
        await appApi.sendMessage(selectedChannel, !!selectedServer, me, text);
        await loadMessages();
      }
      setDraft('');
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!window.zuzuDesktop) return;
    const unsubscribe = window.zuzuDesktop.onUpdateAvailable(release => setUpdateRelease(release));
    return unsubscribe;
  }, []);
  const checkUpdates = async () => {
    if (!window.zuzuDesktop) { setStatus('Release updates are available in the packaged Windows application.'); return; }
    try {
      setUpdating(true);
      const release = await window.zuzuDesktop.checkUpdates();
      setUpdateRelease(release);
      setStatus(release ? 'New ZuzuCord version available: ' + release.tag : 'ZuzuCord is up to date.');
    } catch (error) { showError(error); } finally { setUpdating(false); }
  };
  const downloadUpdate = async () => {
    if (!updateRelease || !window.zuzuDesktop) return;
    try {
      setUpdating(true);
      const result = await window.zuzuDesktop.downloadUpdate(updateRelease);
      setStatus(result.note + ' File: ' + result.name);
      setUpdateRelease(null);
    } catch (error) { showError(error); } finally { setUpdating(false); }
  };
  useEffect(() => {
    if (!selectedServer) { setBoostLevel(0); setInstalledBots([]); return; }
    const serverId = selectedServer;
    Promise.allSettled([appApi.serverBoosts(serverId),appApi.installedBots(serverId),appApi.availableBots()])
      .then(([boosts,installed,available])=>{
        if(boosts.status==='fulfilled')setBoostLevel(boosts.value);
        if(installed.status==='fulfilled')setInstalledBots(installed.value);
        if(available.status==='fulfilled')setBotApps(available.value);
      });
  }, [selectedServer]);
  const boostSelectedServer = async () => {
    if (!selectedServer || !me) return;
    if (!window.confirm('Spend 100 Crystals to permanently upgrade this server? This action cannot be reversed.')) return;
    try {
      const level = await appApi.boostServer(selectedServer);
      setBoostLevel(level);
      const wallet = await appApi.wallet(me);
      setWalletCrystals(wallet.crystals);
      setLegacyCredits(wallet.legacyCredits);
      setStatus('Server boosted to level ' + level + '. Channel capacity is now ' + (30+10*level) + '.');
    } catch(error) { showError(error); }
  };
  const installSelectedBot = async (botId:string) => {
    if(!selectedServer || !isOwner)return;
    try {
      await appApi.installBot(selectedServer,botId);
      setInstalledBots(await appApi.installedBots(selectedServer));
      setStatus('Bot installed successfully. It can now post through the ZuzuCord Bot API.');
    } catch(error) { showError(error); }
  };

  const saveAppearance = async (next: Appearance) => {
    setAppearance(next);
    if (me && next.sync_enabled) {
      try { await appApi.saveBeta(me, next, selectedServer); setStatus('Appearance saved to your ZuzuCord website and Windows app.'); }
      catch (error) { showError(error); }
    } else setStatus('Appearance saved on this Windows device.');
  };

  const action = async () => {
    setBusy(true); setStatus('');
    try {
      if (modal === 'new-server') {
        const created = await appApi.createServer(modalValue);
        await loadServers(); serverSelect(created);
      } else if (modal === 'join-server') {
        const joined = await appApi.joinServer(modalValue);
        await loadServers(); serverSelect(joined);
      } else if (modal === 'new-channel' && selectedServer) {
        await appApi.createChannel(selectedServer, modalValue);
        const list = await appApi.getChannels(selectedServer);
        setChannels(list);
        setSelectedChannel(list[list.length - 1]?.id || null);
      } else if (modal === 'add-friend' && me) {
        const found = await appApi.findUser(modalValue.replace(/^@/, '').toLowerCase());
        if (!found) throw Error('No ZuzuCord account matches that username.');
        if (found.user_id === me) throw Error('You cannot add yourself.');
        await appApi.friendRequest(me, found.user_id); await loadFriends();
      } else if (modal === 'profile' && me) {
        await appApi.saveProfile(me, modalValue, modalOther);
        setProfileName(modalValue); setProfileStatus(modalOther);
      } else if (modal === 'bot' && selectedServer && isOwner) {
        const { data, error } = await client.rpc('zuzucord_set_bot_enabled', {
          p_server: selectedServer, p_enabled: !botEnabled
        });
        if (error) throw error;
        setBotEnabled(data === true);
      }
      setModal(null);
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  };
  const friendDecision = async (requestId: string, accept: boolean) => {
    try { await appApi.respondFriend(requestId, accept); await loadFriends(); }
    catch (error) { showError(error); }
  };
  const roleChange = async (friendId: string, role: string) => {
    if (!selectedServer) return;
    try { await appApi.changeRole(selectedServer, friendId, role); setMembers(await appApi.members(selectedServer)); }
    catch (error) { showError(error); }
  };

  const themeStyle = {
    '--accent': appearance.accent,
    '--gradient-a': appearance.gradient_start,
    '--gradient-b': appearance.gradient_end,
    '--blur-strength': Math.round(appearance.glass_strength / 8) + 'px',
    '--glow-opacity': String(appearance.glass_strength / 100),
  } as CSSProperties;
  const displayedFriends = useMemo(() => friends.filter(friend => {
    if (tab === 'pending' && friend.status !== 'pending') return false;
    if (tab === 'all' && friend.status !== 'accepted') return false;
    if (tab === 'online' && (friend.status !== 'accepted' || !onlineIds.has(friend.id))) return false;
    return !query || friend.username.toLowerCase().includes(query.toLowerCase());
  }), [friends, tab, query, onlineIds]);
  const pendingCount = friends.filter(f => f.status === 'pending' && !f.outgoing).length;
  const messageRows = useMemo(() => (view === 'dm' ? directMessages.map(d => ({
    id: d.id, author_id: d.sender_id, content: d.content, created_at: d.created_at,
    bot_name: null, external_bot_id: null
  })) : messages), [view, messages, directMessages]);
  const getAuthorName = (m: ChatMessage): string => {
    if (m.bot_name) return m.bot_name;
    if (m.external_bot_id) return botApps.find(b=>b.id===m.external_bot_id)?.name || 'ZuzuCord bot';
    if (m.author_id === me) return username || 'You';
    const member = members.find(person => person.user_id === m.author_id);
    const friend = friends.find(person => person.id === m.author_id);
    return member?.username || friend?.username || 'Member ' + m.author_id.slice(0, 7);
  };
  if (loading) return <main className="splash-screen"><Sparkles size={36} /><p>Starting ZuzuCord…</p></main>;

  return <div className={'zuzu-app theme-' + appearance.theme
    + (appearance.gradient_enabled ? ' has-gradient' : '')
    + (appearance.motion_enabled ? ' has-motion' : ' no-motion')
    + (appearance.compact ? ' compact' : '')} style={themeStyle}>
    <header className="titlebar">
      <div className="title-nav"><Sparkles size={15} /> <strong>ZuzuCord</strong> <span>V3 • React Desktop</span></div>
      <span className="window-drag" />
      <div className="title-context">{view === 'friends' ? 'Friends' : view === 'dm' ? 'Direct Messages' : currentServer?.name || 'Public Rooms'}</div>
      <span className="window-drag" />
      <div className="title-release">
        <button className="release-check" title="Check official v-prefixed GitHub releases" disabled={updating}
          onClick={()=>void checkUpdates()}><RefreshCw size={13}/>{updateRelease?'Update '+updateRelease.tag:'Updates'}</button>
      </div>
      <div className="window-controls">
        <IconButton label="Minimize" onClick={() => void window.zuzuDesktop?.windowAction('minimize')}><Minus size={14} /></IconButton>
        <IconButton label="Maximize" onClick={() => void window.zuzuDesktop?.windowAction('maximize')}><Square size={12} /></IconButton>
        <IconButton label="Close" className="close-window" onClick={() => void window.zuzuDesktop?.windowAction('close')}><X size={15} /></IconButton>
      </div>
    </header>
    {notice ? <div className="notice-overlay">
      <div className="notice-card">
        <div className="notice-icon"><ShieldCheck size={26} /></div>
        <h2>Welcome to ZuzuCord</h2>
        <p>ZuzuCord is an independent social client, not affiliated with Discord. Accounts may be restricted for breaking community rules. The developers cannot guarantee that misuse won't result in restrictions. Your legal rights are not waived by this notice.</p>
        <label className="check-line"><input type="checkbox" checked={acknowledge} onChange={e => setAcknowledge(e.target.checked)} /> I understand and agree to follow the community guidelines.</label>
        <button className="button button-primary full" disabled={!acknowledge} onClick={() => setNotice(false)}>Continue to ZuzuCord <ChevronRight size={16} /></button>
      </div>
    </div> : !session ? <Auth onSuccess={async next => {
      setSession(next);
      try { setUsername(await ensureAccount(next)); }
      catch (error) { showError(error); }
    }} /> : <>
      <main className="workspace">
        <nav className="realm-rail" aria-label="Main navigation">
          <button title="Friends" className={'realm-logo ' + (view === 'friends' ? 'selected' : '')}
            onClick={() => { setView('friends'); setSelectedFriend(null); }}>
            <Sparkles size={24} /></button>
          <span className="rail-divider" />
          <button title="Public rooms" className={'realm-bubble ' + (view === 'channel' && !selectedServer ? 'selected' : '')}
            onClick={() => serverSelect(null)}><Globe2 size={23} /></button>
          <button title="Official ZuzuCord announcements" className="realm-bubble official-rail"
            onClick={() => openModal('announcements')}><ShieldCheck size={22} /></button>
          <button title="Crystals wallet and server perks" className="realm-bubble crystals-rail"
            onClick={() => openModal('boost')}><Gem size={21} /></button>
          <div className="rail-space" />
          <IconButton label="Create server" onClick={() => openModal('new-server')}><Plus size={23} /></IconButton>
          <IconButton label="Join server" onClick={() => openModal('join-server')}><ServerIcon size={18} /></IconButton>
          <span className="rail-divider" />
          <IconButton label="Edit appearance" onClick={() => openModal('settings')}><Palette size={22} /></IconButton>
        </nav>
        <nav className="server-rail" aria-label="Your servers">
          <div className="server-rail-title">SPACES</div>
          <button className={'server-circle ' + (!selectedServer && view === 'channel' ? 'current' : '')}
            title="Public rooms" onClick={() => serverSelect(null)}><Hash size={23} /></button>
          <div className="server-divider" />
          {servers.map((server, index) => <button className={'server-circle ' + (selectedServer === server.id ? 'current' : '')}
            key={server.id} onClick={() => serverSelect(server.id)} title={server.name}
            style={{ '--bubble-color': server.accent_color || colors[index % colors.length] } as CSSProperties}>
            {initials(server.name)}
          </button>)}
          <IconButton label="Create another server" onClick={() => openModal('new-server')}><Plus size={19} /></IconButton>
        </nav>
        <section className="sidebar">
          <label className="sidebar-search"><Search size={16} /><input ref={quickSearch}
            placeholder="Find a friend or channel" aria-label="Search friends and channels"
            value={query} onChange={e => setQuery(e.target.value)} /><kbd>Ctrl K</kbd></label>
          <button className={'sidebar-nav-button ' + (view === 'friends' ? 'selected' : '')}
            onClick={() => { setView('friends'); setSelectedFriend(null); }}><Users size={19} /> Friends {pendingCount > 0 && <b className="count-chip">{pendingCount}</b>}</button>
          <button className="sidebar-nav-button" onClick={() => openModal('add-friend')}><UserPlus size={19} /> Add Friend</button>
          <button className="sidebar-nav-button official-nav" onClick={() => openModal('announcements')}>
            <ShieldCheck size={19} /> ZuzuCord Official <span className="official-badge">OFFICIAL</span></button>
          {userRoles.includes('owner') && <button className="sidebar-nav-button owner-nav"
            onClick={()=>openModal('owner-tools')}><Crown size={19}/> Owner controls <span className="official-badge">OWNER</span></button>}
          <div className="sidebar-heading"><span>{selectedServer ? currentServer?.name || 'YOUR SERVER' : 'DIRECT MESSAGES'}</span>
            <IconButton label={selectedServer ? 'Create channel' : 'Add friend'}
              onClick={() => openModal(selectedServer ? 'new-channel' : 'add-friend')}><Plus size={15} /></IconButton></div>
          {view === 'channel' || selectedServer ? <div className="channel-nav">
            {channels.filter(c => !query || c.name.toLowerCase().includes(query.toLowerCase())).map(ch => <button
              key={ch.id} className={'channel-button ' + (selectedChannel === ch.id && view === 'channel' ? 'selected' : '')}
              onClick={() => { setSelectedChannel(ch.id); setView('channel'); setSelectedFriend(null); }}>
              <Hash size={17} /><span>{ch.name}</span></button>)}
            {channels.length === 0 && <div className="sidebar-empty">No channels yet.</div>}
          </div> : <div className="dm-nav">
            {friends.filter(f => f.status === 'accepted').map(friend => <button
              key={friend.id} className={'dm-button ' + (selectedFriend === friend.id && view === 'dm' ? 'selected' : '')}
              onClick={() => { setSelectedFriend(friend.id); setView('dm'); }}>
              <Avatar name={friend.username} size="tiny" /> <span>{friend.username}</span>
              <span className="dm-dot" /></button>)}
            {friends.filter(f => f.status === 'accepted').length === 0 && <div className="sidebar-empty">Add a friend to start a DM.</div>}
          </div>}
          <div className="sidebar-user">
            <Avatar name={username || 'ZuzuCord'} />
            <div className="user-details"><strong>{username || 'ZuzuCord'}</strong>
              <span>{userRoles.includes('owner')?'Owner':userRoles.includes('developer')?'Developer':userRoles.includes('verified')?'Verified':
                beta||userRoles.includes('beta_tester')?'Beta tester':'Member'} · Signed in</span></div>
            <IconButton label="Profile" onClick={() => { setModalValue(profileName); setModalOther(profileStatus); setModal('profile'); }}><Settings2 size={18} /></IconButton>
          </div>
        </section>
        <section className="main-pane">
          {view === 'channel' && selectedServer && currentServer && boostLevel >= 1 &&
            <div className="boosted-server-ribbon" style={{
              '--server-accent':currentServer.accent_color || '#a978ff',
              '--server-gradient':boostLevel>=2 ? currentServer.gradient_color || '#0c0715' : '#0c0715'
            } as CSSProperties}>
              <span><Sparkles size={15}/> {currentServer.name}</span>
              <strong>{boostLevel===3?'LEVEL 3 · BOOSTED SERVER':'BOOST LEVEL '+boostLevel}</strong>
            </div>}
          <div className="content-toolbar">
            <div className="toolbar-heading">
              {view === 'friends' ? <><Users size={21} /><strong>Friends</strong></> :
               view === 'dm' ? <><MessageCircle size={19} /><strong>{currentFriend?.username || 'Direct Messages'}</strong></> :
               <><Hash size={20} /><strong>{currentChannel?.name || 'Select a channel'}</strong></>}
            </div>
            {view === 'friends' ? <div className="toolbar-tabs">
              {(['all','online','pending'] as const).map(next => <button key={next}
                onClick={() => setTab(next)} className={tab === next ? 'selected' : ''}>
                {next.charAt(0).toUpperCase() + next.slice(1)}
                {next === 'pending' && pendingCount > 0 && <b className="count-chip">{pendingCount}</b>}
              </button>)}
              <button className="add-friend-pill" onClick={() => openModal('add-friend')}>Add Friend</button>
            </div> : <span className="channel-description">{view === 'channel' ? currentChannel?.description || 'Community conversation' : 'Private conversation'}</span>}
            <div className="toolbar-right">
              <IconButton label="Refresh" onClick={() => view === 'friends' ? void loadFriends() : view === 'channel'
                ? void loadMessages() : void loadDMs()}><RefreshCw size={19} /></IconButton>
              <IconButton label={rightPanel ? 'Hide activity panel' : 'Show activity panel'}
                onClick={() => setRightPanel(!rightPanel)}>{rightPanel ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}</IconButton>
              <IconButton label="Appearance settings" onClick={() => openModal('settings')}><SlidersHorizontal size={20} /></IconButton>
            </div>
          </div>
          {view === 'friends' ? <>
            <div className="list-search"><Search size={19} /><input placeholder="Search your friends" value={query}
              onChange={e => setQuery(e.target.value)} /></div>
            <div className="list-label">{tab === 'online' ? 'PRESENCE' : tab === 'pending' ? 'PENDING REQUESTS' : 'ALL FRIENDS'} — {displayedFriends.length}</div>
            {displayedFriends.length ? <div className="friend-list">
              {displayedFriends.map(friend => <div className="friend-row" key={friend.requestId}>
                <Avatar name={friend.username} />
                <div className="friend-row-text"><strong>{friend.username}</strong>
                  <small>{friend.status === 'pending'
                    ? friend.outgoing ? 'Friend request sent' : 'Sent you a friend request'
                    : onlineIds.has(friend.id) ? 'Online now' : 'Offline or inactive'}</small></div>
                {friend.status === 'pending' && !friend.outgoing ? <>
                  <IconButton label="Accept friend" onClick={() => void friendDecision(friend.requestId,true)}><Check size={20}/></IconButton>
                  <IconButton label="Decline friend" onClick={() => void friendDecision(friend.requestId,false)}><X size={20}/></IconButton>
                </> : friend.status === 'accepted' ?
                  <IconButton label={'Message '+friend.username} onClick={() => { setSelectedFriend(friend.id); setView('dm'); }}><MessageCircle size={19}/></IconButton> : null}
              </div>)}
            </div> : <div className="empty-content"><UsersRound size={43} />
              <h2>{tab === 'pending' ? 'No pending requests.' : tab === 'online' ? 'Nobody is online right now.' : 'Your friends list is ready.'}</h2>
              <p>{tab === 'pending' ? 'New friend requests will appear here.' : tab === 'online'
                ? 'Friends appear here while their ZuzuCord desktop apps are active.'
                : 'Send a friend request by username to start chatting.'}</p>
              {tab === 'all' && <button className="button button-primary" onClick={() => openModal('add-friend')}><UserPlus size={17}/> Add a friend</button>}
            </div>}
          </> : <div className="conversation-pane">
            <div className="conversation-scroll">
              <div className="conversation-intro"><div className="channel-circle">
                {view === 'channel' ? <Hash size={27} /> : <MessageCircle size={27} />}</div>
                <h2>{view === 'channel' ? '# ' + (currentChannel?.name || 'channel') : currentFriend?.username || 'Conversation'}</h2>
                <p>{view === 'channel'
                  ? 'This is the beginning of the channel. Be respectful and enjoy your community.'
                  : 'Private messages are shared only between you and this accepted friend.'}</p>
              </div>
              {messageRows.map(message => <div className="chat-message" key={message.id}>
                <Avatar name={getAuthorName(message)} size="normal"
                  color={message.bot_name || message.external_bot_id ? '#9275ff' : undefined} />
                <div className="message-text">
                  <div className="message-meta"><strong>{getAuthorName(message)}</strong>
                    {(message.bot_name || message.external_bot_id) && <span className="bot-tag">BOT</span>}
                    <time>{dateTime(message.created_at)}</time></div>
                  <div className="message-content">{message.content}</div>
                </div>
              </div>)}
              <div ref={messagesBottom} />
            </div>
            <form className="composer" onSubmit={send}>
              <button type="button" title="Attachments are not yet available" disabled><Plus size={20}/></button>
              <input value={draft} maxLength={2000} onChange={e=>setDraft(e.target.value)}
                placeholder={view === 'channel' && selectedServer
                  ? 'Message #' + (currentChannel?.name || 'channel') + ' or use /help for ZuzuBot'
                  : 'Message ' + (view === 'dm' ? '@' + (currentFriend?.username || 'friend') : '#public')}
                disabled={busy || (view === 'channel' && !selectedChannel) || (view === 'dm' && !selectedFriend)} />
              <button className="composer-send" aria-label="Send message" disabled={busy || !draft.trim()}><Send size={19}/></button>
            </form>
          </div>}
        </section>
        {rightPanel && <aside className="activity-panel">
          <div className="activity-heading">{view === 'friends' ? 'Your Communities' : view === 'channel' ? 'Server & Activity' : 'Friend Details'}</div>
          {view === 'friends' ? <>
            <div className="activity-box"><h3><ServerIcon size={17}/> Your servers <span>{servers.length}</span></h3>
              {servers.slice(0, 7).map(server => <button className="activity-server" key={server.id}
                onClick={() => serverSelect(server.id)}><Avatar name={server.name} size="tiny"/><span>{server.name}</span><ChevronRight size={16}/></button>)}
              {servers.length === 0 && <p className="muted tiny">No servers joined. Create or join one to start.</p>}
            </div>
            <div className="activity-box"><h3><Heart size={17}/> Connections</h3>
              <div className="activity-metric"><strong>{friends.filter(f=>f.status==='accepted').length}</strong><span>Accepted friends</span></div>
              <div className="activity-metric"><strong>{pendingCount}</strong><span>Incoming requests</span></div>
              <div className="activity-metric"><strong>{onlineIds.size}</strong><span>Online friends</span></div>
              <button className="plain-activity-link" onClick={()=>openModal('announcements')}>
                <ShieldCheck size={15}/> Official announcements <ChevronRight size={14}/></button>
            </div>
            <div className="activity-box"><h3><UsersRound size={17}/> Active friends <span>{onlineIds.size}</span></h3>
              {friends.filter(f => onlineIds.has(f.id) && f.status === 'accepted').slice(0,5).map(f =>
                <button className="activity-server" key={f.id} onClick={() => { setSelectedFriend(f.id);setView('dm'); }}>
                  <Avatar name={f.username} size="tiny"/><span>{f.username}</span><span className="presence-dot"/>
                </button>)}
              {onlineIds.size === 0 && <p className="tiny muted">No accepted friends are active right now.</p>}
            </div>
          </> : view === 'channel' ? <>
            <div className="activity-box"><h3><UsersRound size={17}/> Members <span>{members.length}</span></h3>
              {selectedServer ? members.slice(0, 9).map(member => <div key={member.user_id} className="activity-server">
                <Avatar name={member.username} size="tiny"/><span>{member.username}</span>
                {member.role === 'owner' && <Crown size={15}/>}
                {member.role === 'admin' && <Shield size={15}/>}
              </div>) : <p className="tiny muted">Public rooms are available to active ZuzuCord accounts.</p>}
              {selectedServer && <button className="plain-activity-link" onClick={() => openModal('members')}>View members <ChevronRight size={14}/></button>}
            </div>
            {selectedServer && <div className="activity-box">
              <h3><Bot size={17}/> ZuzuBot <span>{botEnabled ? 'On' : 'Off'}</span></h3>
              <p className="tiny muted">Type /help, /ping, /members, /roll, /time or /rules in chat.</p>
              {serverPermissions.manage_bots && <button className="plain-activity-link" onClick={() => openModal('bot')}>Bot settings <ChevronRight size={14}/></button>}
              <button className="plain-activity-link" onClick={() => openModal('invite')}>Invite to server <ChevronRight size={14}/></button>
              {canCreateChannel && <button className="plain-activity-link" onClick={() => openModal('new-channel')}>Create text channel <ChevronRight size={14}/></button>}
              {isOwner && <button className="plain-activity-link" onClick={()=>openModal('roles')}>
                <Shield size={14}/> Manage server roles <ChevronRight size={14}/></button>}
              {isOwner && <button className="plain-activity-link" onClick={() => openModal('install-bot')}>Manage community bots <ChevronRight size={14}/></button>}
            </div>}
            {selectedServer && <div className="activity-box">
              <h3><Gem size={17}/> Crystals <span>Level {boostLevel}/3</span></h3>
              <p className="tiny muted">Balance: {(walletCrystals + legacyCredits*100).toLocaleString()} Crystals · {30+10*boostLevel} channels</p>
              <button className="plain-activity-link" onClick={() => openModal('boost')}>Crystals & server perks <ChevronRight size={14}/></button>
            </div>}
          </> : <div className="activity-box"><h3><MessageCircle size={17}/> Conversation</h3>
            <div className="activity-profile"><Avatar name={currentFriend?.username || 'Friend'} size="large"/><h3>{currentFriend?.username || 'Friend'}</h3><small>Accepted ZuzuCord friend</small></div>
          </div>}
          <div className="activity-note"><LockKeyhole size={16}/> Account and online activity come from ZuzuCord Supabase. Presence is visible only to accepted friends.</div>
        </aside>}
      </main>
      {updateRelease && <div className="update-banner" role="status">
        <div><RefreshCw size={17}/> <strong>ZuzuCord {updateRelease.tag} is available</strong>
        <small>Official GitHub release with a v-prefixed version tag</small></div>
        <button className="button button-primary" onClick={()=>void downloadUpdate()} disabled={updating}>
          {updating?'Downloading…':'Download installer'}</button>
        <IconButton label="Dismiss update" onClick={()=>setUpdateRelease(null)}><X size={16}/></IconButton>
      </div>}
      {status && <div className="toast" role="status"><span>{status}</span><IconButton label="Dismiss" onClick={()=>setStatus('')}><X size={15}/></IconButton></div>}
      {modal && <Dialog heading={{
        settings:'Appearance & effects', 'new-server':'Create a server','join-server':'Join a server',
        'new-channel':'New text channel','add-friend':'Add a friend',members:'Server members',
        invite:'Invite people',profile:'Your profile',bot:'ZuzuBot settings',
        announcements:'ZuzuCord Official',boost:'Crystals & Server Perks', 'install-bot':'Server bot applications',
        roles:'Server roles & permissions','owner-tools':'ZuzuCord Owner tools'
      }[modal]} subtitle={modal === 'settings' ? 'Make ZuzuCord yours — colors, glass, gradients and motion.' : undefined}
        onClose={() => setModal(null)} wide={modal === 'settings' || modal === 'roles'}>
        {modal === 'settings' ? <AppearanceEditor value={appearance}
          onSave={async next => { await saveAppearance(next); setModal(null); }}
          onImport={async () => {
            if (!me) return null;
            try {
              const remote = await appApi.getBeta(me);
              if (!remote) throw Error('No synced website theme found yet.');
              const next = { ...validateAppearance(remote), compact: appearance.compact };
              setAppearance(next);
              setStatus('Imported your production website theme and gradients.');
              return next;
            } catch (error) { showError(error); return null; }
          }} />
        : modal === 'announcements' ? <div className="modal-body official-inbox">
          <div className="official-header"><ShieldCheck size={26}/><div><strong>Official ZuzuCord account</strong><span>Verified · Read-only platform announcements</span></div></div>
          <p className="tiny muted">These developer-published messages appear for every ZuzuCord account. Replies are disabled.</p>
          {announcements.length===0 ? <p className="muted">No official announcements yet.</p> :
            announcements.map(item=><article key={item.id} className="announcement-item">
              <strong>{item.title}</strong><time>{dateTime(item.created_at)}</time><p>{item.content}</p></article>)}
        </div>
        : modal === 'boost' ? <CrystalCenter userId={me} serverId={selectedServer}
          serverName={currentServer?.name || ''} isOwner={isOwner}
          level={boostLevel} crystals={walletCrystals} legacyCredits={legacyCredits}
          onBoost={boostSelectedServer} onMessage={setStatus} onSaved={loadServers} />
        : modal === 'install-bot' ? <div className="modal-body">
          <p className="muted">Install developer-created ZuzuCord bots in your server. A bot can only post after its server owner approves installation.</p>
          {botApps.length===0?<p className="muted">No bot applications are available.</p>:
            botApps.map(bot=><div key={bot.id} className="bot-app-row">
              <Bot size={19}/><div><strong>{bot.name}</strong><small>{bot.description||bot.id}</small></div>
              {installedBots.includes(bot.id)?<span className="installed-mark">Installed</span>:
                <button className="button button-subtle" onClick={()=>void installSelectedBot(bot.id)}>Install</button>}
            </div>)}
        </div>
        : modal === 'roles' && selectedServer ? <ServerRolesEditor
            serverId={selectedServer} members={members} isOwner={isOwner} />
        : modal === 'owner-tools' && userRoles.includes('owner') ? <OwnerConsole />
        : modal === 'members' ? <div className="members-modal">
          {members.map(member => <div className="member-row" key={member.user_id}>
            <Avatar name={member.username} size="tiny"/><div><strong>{member.username}</strong>
            <small>{member.role}</small>
            {serverRoleAssignments.filter(a=>a.user_id===member.user_id).map(a=>{
              const role=serverCustomRoles.find(r=>r.id===a.role_id);
              return role?<span key={a.role_id} className="member-custom-role"
                style={{color:role.color,borderColor:role.color}}>{role.name}</span>:null;
            })}</div>
            {isOwner && member.user_id !== me && <select defaultValue={member.role}
              onChange={e=>void roleChange(member.user_id,e.target.value)}>
              <option value="member">Member</option><option value="admin">Admin</option></select>}
            {((serverPermissions.manage_members && member.role !== 'owner' && (member.role !== 'admin' || isOwner)) || member.user_id === me && member.role !== 'owner') &&
              <button className="subtle-button" title={member.user_id === me ? 'Leave server' : 'Remove member'}
                onClick={async () => {
                  if (!selectedServer) return;
                  if (!window.confirm(member.user_id===me ? 'Leave this server?' : 'Remove '+member.username+'?')) return;
                  try { await appApi.removeMember(selectedServer,member.user_id);setMembers(await appApi.members(selectedServer));
                    if (member.user_id===me) {setModal(null);serverSelect(null);await loadServers();}}
                  catch(error){showError(error);}
                }}><UserMinus size={17}/></button>}
          </div>)}
        </div>
        : modal === 'invite' ? <div className="modal-body">
          <p className="muted">Only a server owner can reveal its invitation code.</p>
          <button className="button button-primary" onClick={async()=>{
            if(!selectedServer)return;
            try{const code=await appApi.serverInvite(selectedServer);
              if(!code)throw Error('Only the server owner can view this code.');
              await navigator.clipboard.writeText(code);
              setStatus('Invite code copied: '+code);setModal(null);
            }catch(error){showError(error);}
          }}><Copy size={17}/> Copy invitation code</button>
        </div>
        : modal === 'bot' ? <div className="modal-body">
          <p className="muted">ZuzuBot has built-in safe commands for server members. Server owners can toggle it here.</p>
          <div className="setting-line"><Bot size={19}/><span>{botEnabled?'Bot is enabled':'Bot is disabled'}</span></div>
          <button disabled={busy||!isOwner} className="button button-primary" onClick={()=>void action()}>
            {botEnabled?'Disable ZuzuBot':'Enable ZuzuBot'}</button>
        </div>
        : <form className="modal-body" onSubmit={e=>{e.preventDefault();void action();}}>
          <label>{modal==='new-server'?'Community name':modal==='join-server'?'16-character invite code':
            modal==='new-channel'?'Channel name':modal==='add-friend'?'Username':modal==='profile'?'Display name':'Value'}</label>
          <input autoFocus required maxLength={modal==='join-server'?16:modal==='profile'?40:48}
            value={modalValue}
            onChange={e=>setModalValue(e.target.value)}
            placeholder={modal==='new-server'?'My community':modal==='join-server'?'aabbccddeeff1234':
              modal==='new-channel'?'announcements':modal==='add-friend'?'friend_username':'Your name'} />
          {modal==='profile' && <><label>Status message</label><input maxLength={120} value={modalOther}
            onChange={e=>setModalOther(e.target.value)} placeholder="What are you working on?"/></>}
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? 'Working…' : 'Save / Continue'} <ChevronRight size={16}/>
          </button>
          {modal === 'profile' && <button type="button" className="button button-subtle"
            onClick={async () => {
              await client.auth.signOut();
              setSession(null); setUsername(''); setModal(null); setServers([]); setFriends([]);
              setSelectedFriend(null); setSelectedServer(null); setView('friends');
              loadedBeta.current = false;
              setStatus('Signed out of this Windows device.');
            }}><LogOut size={17}/> Sign out of ZuzuCord</button>}
        </form>}
      </Dialog>}
    </>}
  </div>;
}

function AppearanceEditor({ value, onSave, onImport }: {
  value: Appearance; onSave: (next: Appearance) => Promise<void>;
  onImport: () => Promise<Appearance | null>
}) {
  const [p, setP] = useState(value);
  const [busy, setBusy] = useState(false);
  const change = <K extends keyof Appearance>(key: K, val: Appearance[K]) =>
    setP(current => ({ ...current, [key]: val }));
  const previewStyle = {
    '--accent': p.accent, '--gradient-a': p.gradient_start, '--gradient-b': p.gradient_end
  } as CSSProperties;
  return <div className="appearance-editor">
    <div className="appearance-controls">
      <label>Base theme</label>
      <div className="choice-grid">
        {([['oled','OLED Black'],['graphite','Graphite'],['midnight','Midnight']] as const)
          .map(([id,label]) => <button key={id} className={'theme-choice '+(p.theme===id?'chosen':'')}
            onClick={()=>change('theme',id)}><Moon size={16}/><span>{label}</span>{p.theme===id&&<Check size={15}/>}</button>)}
      </div>
      <label>Accent color</label>
      <div className="swatch-row">{colors.map(c=><button key={c} style={{background:c}} title={c}
        className={p.accent===c?'swatch chosen':'swatch'} onClick={()=>change('accent',c)} />)}
        <input type="color" title="Custom accent" value={p.accent} onChange={e=>change('accent',e.target.value)}/></div>
      <div className="setting-line"><div><strong>Gradient background</strong><small>Layer two colors into the OLED workspace.</small></div>
        <input type="checkbox" checked={p.gradient_enabled} onChange={e=>change('gradient_enabled',e.target.checked)}/></div>
      <div className="color-fields"><label>Start<input aria-label="Gradient start" type="color" value={p.gradient_start}
        onChange={e=>change('gradient_start',e.target.value)}/></label>
        <label>End<input aria-label="Gradient end" type="color" value={p.gradient_end}
          onChange={e=>change('gradient_end',e.target.value)}/></label></div>
      <div className="setting-line"><div><strong>Glass & glow</strong><small>{p.glass_strength}% effect strength</small></div>
        <input aria-label="Glass strength" type="range" min="0" max="100" value={p.glass_strength}
          onChange={e=>change('glass_strength',Number(e.target.value))}/></div>
      <div className="setting-line"><div><strong>Interface animations</strong><small>Respects Windows reduced-motion preferences.</small></div>
        <input type="checkbox" checked={p.motion_enabled} onChange={e=>change('motion_enabled',e.target.checked)}/></div>
      <div className="setting-line"><div><strong>Compact mode</strong><small>Show more channels and conversations.</small></div>
        <input type="checkbox" checked={p.compact} onChange={e=>change('compact',e.target.checked)}/></div>
      <div className="setting-line"><div><strong>Production website synchronization</strong><small>Available to every ZuzuCord account. Sync colors, motion and your selected server.</small></div>
        <input type="checkbox" checked={p.sync_enabled}
          onChange={e=>change('sync_enabled',e.target.checked)}/></div>
    </div>
    <div className="appearance-preview-wrap">
      <h3>LIVE PREVIEW</h3>
      <div className={'appearance-preview '+(p.gradient_enabled?'gradient-on':'')} style={previewStyle}>
        <div className="preview-rail">Z<br/>#<br/>+</div>
        <div className="preview-sidebar"><span>YOUR SERVER</span><p># general</p><p># welcome</p><p># updates</p></div>
        <div className="preview-main"><b># general</b><div className="preview-bubble">Welcome to ZuzuCord</div>
          <div className="preview-bubble muted-bubble">Your desktop. Your colors.</div><div className="preview-input">Message #general</div></div>
      </div>
      <p className="tiny muted">Themes are stored on your computer. Enable website sync to share your preferences securely across devices.</p>
      <button className="button button-subtle"
        onClick={async()=>{ const remote=await onImport(); if(remote) setP(remote); }}>
        <RefreshCw size={16}/> Import production website theme</button>
      <button className="button button-subtle" onClick={()=>setP({...DEFAULT_APPEARANCE,sync_enabled:false})}>Restore defaults</button>
      <button className="button button-primary full" disabled={busy} onClick={async()=>{setBusy(true); try{await onSave(p);}finally{setBusy(false);}}}>
        <Check size={17}/> Apply & save appearance</button>
    </div>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
