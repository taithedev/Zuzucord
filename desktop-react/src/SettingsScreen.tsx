import React, { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BadgeCheck, Bell, Check, ChevronRight, Cloud, Copy, Crown, ExternalLink, Eye,
  EyeOff, Gem, Hash, KeyRound, LockKeyhole, LogOut, Monitor, Moon, Palette, RefreshCw,
  Shield, ShieldCheck, SlidersHorizontal, Sparkles, UserRound, Users, Volume2, X } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { client, DEFAULT_APPEARANCE, validateAppearance, type Appearance } from './api';
import { type ClientPreferences, DEFAULT_CLIENT_PREFERENCES } from './clientPreferences';
import { ProfileStudio } from './ProfileStudio';
import { VoiceDiagnostics } from './VoiceDiagnostics';

type Page = 'account'|'profile'|'security'|'privacy'|'notifications'|'appearance'|
  'accessibility'|'updates'|'connections'|'server-tools'|'device'|'voice'|'about'|'developer-tools';
type UpdateState = {phase:string;version:string;percent:number;message:string};
type Props = {
  session:Session; username:string; roles:string[]; profileName:string; profileStatus:string;
  appearance:Appearance; preferences:ClientPreferences; updateState:UpdateState;
  onClose:()=>void; onAppearance:(appearance:Appearance)=>Promise<void>;
  onImport:()=>Promise<Appearance|null>; onPreferences:(p:ClientPreferences)=>void;
  onProfile:(name:string,status:string)=>Promise<void>; onLogout:()=>Promise<void>;
  onCheckUpdates:()=>Promise<void>; onRestartUpdate:()=>Promise<void>;
  onOpenServerRoles:()=>void; onOpenCrystals:()=>void;
  onOpenDeveloper:()=>void; onAvatarSaved:(url:string|null)=>void;
  hasServer:boolean; serverName:string;
};
const tabs: {group:string;links:{page:Page;label:string;icon:React.ElementType}[]}[] = [
  {group:'ACCOUNT',links:[
    {page:'account',label:'My Account',icon:UserRound},
    {page:'profile',label:'Profiles',icon:BadgeCheck},
    {page:'security',label:'Password & Security',icon:LockKeyhole},
    {page:'privacy',label:'Data & Privacy',icon:Shield}
  ]},
  {group:'PREFERENCES',links:[
    {page:'notifications',label:'Notifications',icon:Bell},
    {page:'appearance',label:'Appearance & Themes',icon:Palette},
    {page:'accessibility',label:'Accessibility',icon:Eye},
    {page:'voice',label:'Voice & Microphone',icon:Volume2}
  ]},
  {group:'ZUZUCORD',links:[
    {page:'updates',label:'Updates',icon:RefreshCw},
    {page:'device',label:'Device & Network',icon:Monitor},
    {page:'connections',label:'Website Sync',icon:Cloud},
    {page:'server-tools',label:'Server Tools',icon:Users},
    {page:'developer-tools',label:'Developer Portal',icon:KeyRound},
    {page:'about',label:'Why ZuzuCord?',icon:Sparkles}
  ]}
];
const swatches=['#a978ff','#8798fc','#9fd8b9','#f2a6b9','#d3d3e0','#e3b685'];
const gradientPresets = [
  {name:'Amethyst',colors:['#28094b','#39175c','#080917','#1d0a35']},
  {name:'Abyss',colors:['#06292f','#133a4f','#05090e','#0b182b']},
  {name:'Ember',colors:['#38121a','#47231b','#0b080d','#221323']},
  {name:'Carbon',colors:['#1d1d24','#2c3039','#020305','#15171d']},
  {name:'Orchid',colors:['#250e3a','#572d5c','#0c0616','#270c34']}
] as const;
function colorFromCSS(source:string,keys:string[]):string|undefined {
  for(const key of keys) {
    // Keys are fixed, known CSS variable names (no arbitrary regex input).
    const regex=new RegExp(key+'\\s*:\\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})(?![0-9a-fA-F])','i');
    const match=regex.exec(source);
    if(match){
      const color=match[1];
      return color.length===4?'#'+[...color.slice(1)].map(x=>x+x).join(''):color;
    }
  }
  return undefined;
}

function Tile({title,description,action,children}:{
  title:string;description?:string;action?:React.ReactNode;children?:React.ReactNode
}){return <div className="settings-tile"><div className="settings-tile-copy"><strong>{title}</strong>
    {description&&<p>{description}</p>}</div>{children||action}</div>;}
function Toggle({on,label,change,disabled=false}:{
  on:boolean;label:string;change:(next:boolean)=>void;disabled?:boolean
}){return <button className={'settings-switch '+(on?'on':'')} role="switch"
  aria-label={label} aria-checked={on} disabled={disabled}
  onClick={()=>change(!on)}><span/></button>;}
function Section({eyebrow,title,description,children}:{
  eyebrow:string;title:string;description:string;children:React.ReactNode
}){return <section className="settings-section">
  <span className="settings-overline">{eyebrow}</span><h2>{title}</h2>
  <p className="settings-section-description">{description}</p>{children}
</section>;}
function SettingButton({children,onClick,disabled=false}:{
  children:React.ReactNode;onClick:()=>void;disabled?:boolean
}){return <button className="settings-action" type="button" onClick={onClick}
  disabled={disabled}>{children}</button>;}

export function SettingsScreen(props:Props) {
  const { session,username,roles,profileName,profileStatus,appearance,preferences,updateState,
    onClose,onAppearance,onImport,onPreferences,onProfile,onLogout,
    onCheckUpdates,onRestartUpdate,onOpenServerRoles,onOpenCrystals,onOpenDeveloper,
    onAvatarSaved,hasServer,serverName }=props;
  const [page,setPage]=useState<Page>('account');
  const [search,setSearch]=useState('');
  const [draftTheme,setDraftTheme]=useState(appearance);
  const themeFileRef=useRef<HTMLInputElement|null>(null);
  const themeJsonRef=useRef<HTMLInputElement|null>(null);
  const platform=window.zuzuDesktop?.platform || 'web';
  const systemLabel=platform==='win32'?'Windows':platform==='darwin'?'macOS':platform==='linux'?'Linux':'this device';
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState('');
  const [failed,setFailed]=useState(false);
  const [version,setVersion]=useState('');
  const [startup,setStartup]=useState<{available:boolean;enabled:boolean}>({available:false,enabled:false});
  const [network,setNetwork]=useState<{checkedAt:string;targets:Record<string,{
    reachable:boolean;httpStatus?:number;latencyMs:number|null;error?:string
  }> }|null>(null);
  const [networkBusy,setNetworkBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    void window.zuzuDesktop?.getStartup().then(s=>{if(active)setStartup(s);})
      .catch(()=>{});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{void window.zuzuDesktop?.version().then(setVersion).catch(()=>{});},[]);
  useEffect(()=>{setDraftTheme(appearance);},[appearance]);
  function change<K extends keyof Appearance>(key:K,value:Appearance[K]){
    setDraftTheme(current=>({...current,[key]:value}));
  }
  const notice=(message:string,error=false)=>{setFeedback(message);setFailed(error);};
  const changePassword=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(password.length<10||password.length>128)return notice('Choose a password between 10 and 128 characters.',true);
    setBusy(true);
    try{
      const {error}=await client.auth.updateUser({password});
      if(error)throw error;
      setPassword('');notice('Password updated successfully.');
    }catch(e){notice(e instanceof Error?e.message:String(e),true)}
    finally{setBusy(false)}
  };
  const saveAppearance=async()=>{
    setBusy(true);
    try{await onAppearance(draftTheme);notice('Appearance saved for this device'+(draftTheme.sync_enabled?' and website sync.':'.'));}
    catch(e){notice(e instanceof Error?e.message:String(e),true)}
    finally{setBusy(false)}
  };
  const downloadTheme=async()=>{
    setBusy(true);
    try{
      const remote=await onImport();
      if(!remote)throw Error('No synced website appearance exists yet.');
      setDraftTheme(remote);notice('Website colors imported. Press Save Appearance to keep them.');
    }catch(e){notice(e instanceof Error?e.message:String(e),true)}
    finally{setBusy(false)}
  };
  const changeStartup=async(enabled:boolean)=>{
    try{
      if(!window.zuzuDesktop || platform!=='win32')throw Error('Auto-start is currently available only on the Windows installer.');
      const next=await window.zuzuDesktop.setStartup(enabled);
      setStartup(next);
      notice(next.enabled?'ZuzuCord will open at Windows sign-in.':'ZuzuCord will no longer start automatically.');
    }catch(e){notice(e instanceof Error?e.message:String(e),true);}
  };
  const testNetwork=async()=>{
    setNetworkBusy(true);
    try {
      if(!window.zuzuDesktop)throw Error('Network diagnostics require the desktop application.');
      const result=await window.zuzuDesktop.checkNetwork();
      setNetwork(result);
      notice('Connection checks completed.');
    }catch(e){notice(e instanceof Error?e.message:String(e),true);}
    finally{setNetworkBusy(false);}
  };
  const changeAlerts=async(enabled:boolean)=>{
    if(enabled){
      if(!('Notification' in window)){notice('Desktop notifications are unavailable on this device.',true);return;}
      const permission=await Notification.requestPermission();
      if(permission!=='granted'){notice('Desktop notification permission was not granted.',true);return;}
    }
    onPreferences({...preferences,desktopFriendAlerts:enabled});
    notice(enabled?'Friend request alerts enabled on this device.':'Friend request alerts disabled.');
  };
  const importPalette=async(file?:File)=>{
    if(!file)return;
    if(file.size>150000||!file.name.toLowerCase().endsWith('.css')){
      notice('Choose a CSS theme file smaller than 150 KB.',true);return;
    }
    try {
      const source=await file.text();
      // Only read literal hex color variables. Never inject CSS or plugin code.
      const accent=colorFromCSS(source,['--brand-experiment','--brand-500','--accent','--blurple']);
      const background=colorFromCSS(source,['--background-primary','--bg-base-primary','--background-tertiary']);
      const secondary=colorFromCSS(source,['--background-secondary','--bg-surface-raised']);
      const middle=colorFromCSS(source,['--background-secondary-alt','--bg-surface-overlay']);
      if(!accent&&!background&&!secondary&&!middle)throw Error('No supported hex color tokens found in this CSS theme.');
      setDraftTheme(old=>({...old,
        accent:accent||old.accent, gradient_start:secondary||old.gradient_start,
        gradient_middle:middle||old.gradient_middle,gradient_end:background||old.gradient_end,
        gradient_enabled:true
      }));
      notice('Theme colors imported to the preview. Press Save Appearance to apply them.');
    }catch(error){notice(error instanceof Error?error.message:String(error),true);}
    finally{if(themeFileRef.current)themeFileRef.current.value='';}
  };
  const exportTheme=()=>{
    const payload={format:'zuzucord-theme-v1',appearance:draftTheme,preferences};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='zuzucord-theme.json';link.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    notice('Theme preset exported.');
  };
  const importTheme=async(file?:File)=>{
    if(!file)return;
    try{
      if(file.size>40000||!file.name.endsWith('.json'))throw Error('Choose a ZuzuCord JSON theme under 40 KB.');
      const parsed=JSON.parse(await file.text()) as {format?:string;appearance?:unknown;preferences?:Record<string,unknown>};
      if(parsed.format!=='zuzucord-theme-v1'||!parsed.appearance)throw Error('Invalid ZuzuCord theme file.');
      setDraftTheme(validateAppearance(parsed.appearance));
      notice('Theme imported into the preview. Save Appearance to apply.');
    }catch(error){notice(error instanceof Error?error.message:String(error),true);}
    finally{if(themeJsonRef.current)themeJsonRef.current.value='';}
  };
  const copy=async(value:string)=>{
    try{await navigator.clipboard.writeText(value);notice('Copied to clipboard.');}
    catch{notice('Could not access clipboard.',true);}
  };
  const filtered=tabs.map(g=>({...g,links:g.links.filter(item=>
    (item.page!=='developer-tools'||roles.includes('developer')) &&
    (item.label+' '+g.group).toLowerCase().includes(search.trim().toLowerCase()))}))
    .filter(g=>g.links.length>0);
  const pageTitle=tabs.flatMap(t=>t.links).find(link=>link.page===page)?.label||'Settings';
  const alias=username+'@zuzucord.com';
  const previewStyle={'--accent':draftTheme.accent,
    '--gradient-a':draftTheme.gradient_start,'--gradient-middle':draftTheme.gradient_middle,
    '--gradient-b':draftTheme.gradient_end,'--gradient-accent':draftTheme.gradient_accent,
    '--gradient-angle':draftTheme.gradient_angle+'deg',
    '--glow-position':draftTheme.glow_position+'%',
    '--ui-radius':preferences.cornerRadius+'px',
    '--glow-intensity':String(preferences.glowIntensity/100)} as CSSProperties;
  return <div className="settings-screen" role="dialog" aria-modal="true" aria-label="ZuzuCord settings">
    <aside className="settings-navigation">
      <div className="settings-brand"><div className="settings-brand-logo">Z</div>
        <div><strong>ZuzuCord</strong><small>Personal settings</small></div></div>
      <button className="settings-identity" onClick={()=>{setPage('profile');notice('')}}>
        <div className="settings-user-avatar">{username.slice(0,2).toUpperCase()}</div>
        <div><strong>{profileName||username}</strong><small>@{username}</small></div><ChevronRight size={16}/>
      </button>
      <label className="settings-search"><SlidersHorizontal size={16}/>
        <input value={search} placeholder="Find a setting" aria-label="Find a setting"
          onChange={e=>setSearch(e.target.value)}/><kbd>Ctrl ,</kbd></label>
      <div className="settings-navigation-scroll">
        {filtered.map(group=><div className="settings-nav-group" key={group.group}>
          <span>{group.group}</span>{group.links.map(link=><button type="button"
            className={'settings-nav-link '+(page===link.page?'selected':'')}
            key={link.page} onClick={()=>{setPage(link.page);setFeedback('')}}>
            <link.icon size={17}/>{link.label}
          </button>)}</div>)}
        {filtered.length===0&&<p className="tiny muted">No matching settings.</p>}
      </div>
      <div className="settings-nav-footer"><button onClick={()=>void onLogout()}>
        <LogOut size={17}/> Log out</button><small>ZuzuCord · Settings</small></div>
    </aside>
    <main className="settings-content">
      <header className="settings-content-top"><span>USER SETTINGS <ChevronRight size={14}/> <strong>{pageTitle}</strong></span>
        <button onClick={onClose} title="Close settings (Esc)" aria-label="Close settings"><X size={21}/>
          <small>ESC</small></button></header>
      <div className="settings-scroll" key={page}>
      {page==='account'&&<Section eyebrow="ACCOUNT" title="My Account"
        description="Your ZuzuCord identity, account details, and current access.">
        <div className="settings-profile-banner"><div className="settings-profile-orb">{username.slice(0,1).toUpperCase()}</div>
          <div><h3>{profileName||username}</h3><p>@{username} · {roles.includes('owner')?'Owner':roles.includes('developer')?'Developer':'Member'}</p>
            <div className="settings-badges">{roles.map(role=><span key={role}><ShieldCheck size={12}/>{role.replace('_',' ')}</span>)}
            {roles.length===0&&<span><BadgeCheck size={12}/> Community member</span>}</div></div>
        </div>
        <div className="settings-stack">
          <Tile title="Username" description="Your unique account identifier.">
            <strong className="settings-right">{username}</strong></Tile>
          <Tile title="ZuzuCord ID" description="A login alias, not an email inbox.">
            <SettingButton onClick={()=>void copy(alias)}><Copy size={15}/> {alias}</SettingButton></Tile>
          <Tile title="Account ID" description="Useful when requesting help or granting platform roles.">
            <SettingButton onClick={()=>void copy(session.user.id)}><Copy size={15}/> Copy ID</SettingButton></Tile>
          <Tile title="Email recovery" description="Username-only accounts do not have a working recovery inbox.">
            <strong className="settings-right">Not configured</strong></Tile>
          <Tile title="Display name & status" description="Choose how other members see you.">
            <SettingButton onClick={()=>setPage('profile')}>Edit Profile <ChevronRight size={15}/></SettingButton></Tile>
        </div>
      </Section>}
      {page==='profile'&&<Section eyebrow="PROFILE CUSTOMIZATION" title="Make it yours"
        description="Upload a profile photo or banner, choose custom colors, and edit your bio.">
        <ProfileStudio userId={session.user.id} username={username}
          onBasicSaved={onProfile} onAvatarSaved={onAvatarSaved}/>
      </Section>}
      {page==='security'&&<Section eyebrow="ACCOUNT PROTECTION" title="Password & Security"
        description="Manage your password and signed-in account safely.">
        <div className="settings-note"><LockKeyhole size={18}/> ZuzuCord uses Supabase authentication. Passwords are never stored in desktop settings.</div>
        <form className="settings-password-form" onSubmit={e=>void changePassword(e)}>
          <label>New password (minimum 10 characters)</label><div className="settings-password-input">
            <input type={showPassword?'text':'password'} value={password}
              autoComplete="new-password" minLength={10} maxLength={128}
              onChange={e=>setPassword(e.target.value)} placeholder="Enter new password" required/>
            <button type="button" onClick={()=>setShowPassword(!showPassword)}
              aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button>
          </div>
          <small>Use a unique passphrase. Username-only accounts may not have email recovery available.</small>
          <button className="button button-primary" disabled={busy} type="submit"><KeyRound size={16}/> Change Password</button>
        </form>
        <div className="settings-stack"><Tile title="This device"
          description="Saved sign-in uses system encryption when available; otherwise session storage is temporary.">
          <strong className="settings-right">{systemLabel}</strong></Tile>
          <Tile title="Sign out of this device" description="Close your active session and return to the login screen.">
            <SettingButton onClick={()=>void onLogout()}><LogOut size={15}/> Sign out</SettingButton></Tile></div>
        <p className="tiny muted">Multi-factor authentication and remote device management are not currently offered in ZuzuCord. We don't display fictional security statuses.</p>
      </Section>}
      {page==='privacy'&&<Section eyebrow="PRIVACY" title="Data & Privacy"
        description="Control what this app displays and stores on your computer.">
        <div className="settings-stack">
          <Tile title="Activity sidebar" description="Show real friend and server activity while browsing channels.">
            <Toggle on={preferences.showActivityPanel} label="Activity sidebar"
              change={v=>onPreferences({...preferences,showActivityPanel:v})}/></Tile>
          <Tile title="Desktop friend alerts"
            description="Notify you when a new friend request arrives while the application is running.">
            <Toggle on={preferences.desktopFriendAlerts} label="Desktop friend alerts"
              change={v=>void changeAlerts(v)}/></Tile>
          <Tile title="Local preferences" description="Clear non-sensitive appearance, accessibility and notification preferences on this PC.">
            <SettingButton onClick={()=>{
              if(!window.confirm('Reset local interface preferences on this device?'))return;
              onPreferences(DEFAULT_CLIENT_PREFERENCES);notice('Local preferences reset.');
            }}>Restore defaults</SettingButton></Tile>
        </div>
        <div className="settings-note"><Shield size={18}/> Messages, roles, servers, and friend requests remain protected by ZuzuCord's Supabase access rules. Local switches do not replace server-side privacy controls.</div>
      </Section>}
      {page==='notifications'&&<Section eyebrow="STAY UPDATED" title="Notifications"
        description="Choose which alerts ZuzuCord shows on this device.">
        <div className="settings-stack"><Tile title="New friend requests"
          description="A desktop alert when someone sends you a friend request. You can turn it off anytime.">
          <Toggle on={preferences.desktopFriendAlerts} label="Friend request notifications"
            change={v=>void changeAlerts(v)}/></Tile>
          <Tile title="In-app alerts" description="Important confirmations and errors appear inside the app.">
            <strong className="settings-right">Enabled</strong></Tile></div>
        <p className="tiny muted">Message pings, server-wide mentions and mobile push notifications are not implemented yet. This screen only controls working local alerts.</p>
      </Section>}
      {page==='appearance'&&<Section eyebrow="LOOK & FEEL" title="Appearance"
        description="Give ZuzuCord a personal look while keeping channels and text readable.">
        <div className="settings-appearance-layout">
          <div className="settings-appearance-fields">
            <label className="settings-input-label">Theme</label>
            <div className="settings-theme-selector">
              {(['oled','graphite','midnight'] as const).map(theme=><button type="button"
                key={theme} className={draftTheme.theme===theme?'selected':''}
                onClick={()=>change('theme',theme)}><Moon size={16}/>
                {theme==='oled'?'OLED Black':theme==='graphite'?'Graphite':'Midnight'}
                {draftTheme.theme===theme&&<Check size={14}/>}</button>)}
            </div>
            <label className="settings-input-label">Accent color</label>
            <div className="settings-accent-row">{swatches.map(color=><button
              type="button" key={color} title={'Accent '+color}
              className={'settings-swatch '+(draftTheme.accent===color?'selected':'')}
              style={{background:color}} onClick={()=>change('accent',color)}/>)}
              <label className="settings-custom-swatch">Custom <input type="color"
                value={draftTheme.accent} onChange={e=>change('accent',e.target.value)}/></label></div>
            <Tile title="Ambient gradients" description="Soft background blending behind channels.">
              <Toggle on={draftTheme.gradient_enabled} label="Ambient gradients"
                change={v=>change('gradient_enabled',v)}/></Tile>
            <div className="settings-subsection-heading"><strong>Layered gradient studio</strong>
              <small>Four colors, one smooth canvas</small></div>
            <div className="settings-gradient-presets" role="group" aria-label="Gradient presets">
              {gradientPresets.map(preset=><button type="button" key={preset.name}
                className="settings-gradient-preset"
                style={{background:'linear-gradient(135deg, '+preset.colors.join(', ')+')'}}
                onClick={()=>setDraftTheme(old=>({...old,gradient_enabled:true,
                  gradient_start:preset.colors[0],gradient_middle:preset.colors[1],
                  gradient_end:preset.colors[2],gradient_accent:preset.colors[3]}))}>
                <span>{preset.name}</span></button>)}
            </div>
            <div className="settings-color-fields settings-four-colors">
              <label>Layer 1 · base<input type="color" value={draftTheme.gradient_start}
                onChange={e=>change('gradient_start',e.target.value)}/></label>
              <label>Layer 2 · middle<input type="color" value={draftTheme.gradient_middle}
                onChange={e=>change('gradient_middle',e.target.value)}/></label>
              <label>Layer 3 · depth<input type="color" value={draftTheme.gradient_end}
                onChange={e=>change('gradient_end',e.target.value)}/></label>
              <label>Layer 4 · highlight<input type="color" value={draftTheme.gradient_accent}
                onChange={e=>change('gradient_accent',e.target.value)}/></label>
            </div>
            <label className="settings-range">Gradient angle <span>{draftTheme.gradient_angle}°</span>
              <input type="range" min="0" max="360" step="5" value={draftTheme.gradient_angle}
                onChange={e=>change('gradient_angle',Number(e.target.value))}/></label>
            <label className="settings-range">Highlight position <span>{draftTheme.glow_position}%</span>
              <input type="range" min="0" max="100" step="5" value={draftTheme.glow_position}
                onChange={e=>change('glow_position',Number(e.target.value))}/></label>
            <div className="settings-theme-import">
              <div><strong>Vencord / BetterDiscord palette</strong><small>Import supported hex color tokens from a CSS theme. No plugins or external CSS will run.</small></div>
              <button type="button" className="button button-subtle" onClick={()=>themeFileRef.current?.click()}>Import colors</button>
              <input ref={themeFileRef} type="file" accept=".css,text/css" hidden
                onChange={event=>void importPalette(event.target.files?.[0])}/>
            </div>
            <label className="settings-range">Background glow <span>{draftTheme.glass_strength}%</span>
              <input type="range" min={0} max={100} value={draftTheme.glass_strength}
                onChange={e=>change('glass_strength',Number(e.target.value))}/></label>
            <div className="settings-subsection-heading"><strong>Workspace studio</strong><small>Applied immediately and stored on this device</small></div>
            <label className="settings-range">Sidebar width <span>{preferences.sidebarWidth}px</span>
              <input type="range" min="220" max="380" step="5" value={preferences.sidebarWidth}
                onChange={e=>onPreferences({...preferences,sidebarWidth:Number(e.target.value)})}/></label>
            <label className="settings-range">Corner rounding <span>{preferences.cornerRadius}px</span>
              <input type="range" min="4" max="24" step="2" value={preferences.cornerRadius}
                onChange={e=>onPreferences({...preferences,cornerRadius:Number(e.target.value)})}/></label>
            <label className="settings-range">Server icon scale <span>{preferences.serverIconScale}%</span>
              <input type="range" min="80" max="120" step="5" value={preferences.serverIconScale}
                onChange={e=>onPreferences({...preferences,serverIconScale:Number(e.target.value)})}/></label>
            <label className="settings-range">UI bloom intensity <span>{preferences.glowIntensity}%</span>
              <input type="range" min="0" max="100" step="5" value={preferences.glowIntensity}
                onChange={e=>onPreferences({...preferences,glowIntensity:Number(e.target.value)})}/></label>
            <label className="settings-input-label">Background overlay</label>
            <div className="settings-theme-selector">
              {(['none','grid','dots'] as const).map(pattern=><button key={pattern} type="button"
                className={preferences.backgroundPattern===pattern?'selected':''}
                onClick={()=>onPreferences({...preferences,backgroundPattern:pattern})}>
                {pattern==='none'?'Clean':pattern==='grid'?'Grid':'Dots'}</button>)}
            </div>
            <label className="settings-input-label">Message appearance</label>
            <div className="settings-theme-selector">
              {(['classic','cards'] as const).map(style=><button key={style} type="button"
                className={preferences.messageStyle===style?'selected':''}
                onClick={()=>onPreferences({...preferences,messageStyle:style})}>
                {style==='classic'?'Classic rows':'Message cards'}</button>)}
            </div>
            <div className="settings-action-row">
              <button type="button" className="button button-subtle" onClick={exportTheme}>Export theme JSON</button>
              <button type="button" className="button button-subtle"
                onClick={()=>themeJsonRef.current?.click()}>Import theme JSON</button>
              <input ref={themeJsonRef} type="file" accept=".json,application/json" hidden
                onChange={e=>void importTheme(e.target.files?.[0])}/>
              <button type="button" className="button button-subtle" onClick={()=>{
                onPreferences({...DEFAULT_CLIENT_PREFERENCES,fontScale:preferences.fontScale,
                  desktopFriendAlerts:preferences.desktopFriendAlerts,showActivityPanel:preferences.showActivityPanel,
                  highContrast:preferences.highContrast,messageSpacing:preferences.messageSpacing});
                notice('Workspace layout restored to defaults.');
              }}>Reset layout</button>
            </div>
            <Tile title="Animated background" description="Subtle motion behind the workspace.">
              <Toggle on={draftTheme.motion_enabled} label="Animated background"
                change={v=>change('motion_enabled',v)}/></Tile>
            <Tile title="Compact navigation" description="Fit more messages and channels on the screen.">
              <Toggle on={draftTheme.compact} label="Compact navigation"
                change={v=>change('compact',v)}/></Tile>
            <div className="settings-action-row"><button className="button button-primary"
              disabled={busy} onClick={()=>void saveAppearance()}><Check size={16}/> Save Appearance</button>
              <button className="button button-subtle" onClick={()=>setDraftTheme(DEFAULT_APPEARANCE)}>Reset preview</button></div>
          </div>
          <div className="settings-live-preview"><span>LIVE PREVIEW</span>
            <div className={'settings-miniapp '+(draftTheme.gradient_enabled?'on':'')} style={previewStyle}>
              <div className="settings-mini-rail"><b>Z</b><div>#</div><div>+</div></div>
              <div className="settings-mini-left"><strong>Your community</strong><p># general</p><p># announcements</p><p># media</p></div>
              <div className="settings-mini-chat"><strong># general</strong><p>Welcome to ZuzuCord.</p><div>Change your colors and make it yours.</div><small>Message #general</small></div>
            </div><small>Preview only. Click Save Appearance to apply your changes.</small></div>
        </div>
      </Section>}
      {page==='accessibility'&&<Section eyebrow="COMFORT & READABILITY" title="Accessibility"
        description="Adjust text size, density and visual effects.">
        <div className="settings-stack">
          <Tile title="High contrast" description="Strengthen text colors, control borders, and keyboard focus indicators.">
            <Toggle on={preferences.highContrast} label="High contrast"
              change={v=>onPreferences({...preferences,highContrast:v})}/></Tile>
          <Tile title="Reduce motion" description="Disable animated backgrounds and nonessential transitions.">
            <Toggle on={!appearance.motion_enabled} label="Reduce motion"
              change={v=>void onAppearance({...appearance,motion_enabled:!v})}/></Tile>
          <Tile title="Message density" description="Control spacing between individual messages.">
            <select className="settings-select" value={preferences.messageSpacing}
              aria-label="Message density" onChange={e=>onPreferences({...preferences,
                messageSpacing:e.target.value as 'comfortable'|'compact'})}>
              <option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></Tile>
        </div>
        <label className="settings-range">Text size <span>{preferences.fontScale}%</span>
          <input type="range" min="85" max="125" step="5" value={preferences.fontScale}
            onChange={e=>onPreferences({...preferences,fontScale:Number(e.target.value)})}/></label>
      </Section>}
      {page==='voice'&&<Section eyebrow="VOICE CONTROLS" title="Voice & Microphone"
        description="Check microphone permissions and test your input with a local audio sample.">
        <VoiceDiagnostics/>
      </Section>}
      {page==='device'&&<Section eyebrow="DESKTOP DEVICE" title="Device & Network"
        description="Control startup behavior and check ZuzuCord connectivity.">
        <div className="settings-stack">
          <Tile title="Start with device" description={startup.available?'Start at Windows sign-in (off by default).':'Manual launch on macOS and Linux builds; auto-start is not configured.'}>
            <Toggle label="Launch at Windows sign-in" on={startup.enabled}
              disabled={!startup.available} change={v=>void changeStartup(v)}/></Tile>
          <Tile title="Device permissions" description="Uses standard app privileges. Microphone access is requested only when needed.">
            <strong className="settings-right">Standard user</strong></Tile>
        </div>
        <div className="settings-note"><Shield size={18}/> ZuzuCord does not require permanent system administrator privileges. Some operating systems require approval for app installation.</div>
        <div className="settings-network-card">
          <div className="settings-network-title"><Monitor size={18}/>
            <div><strong>Network diagnostics</strong>
              <p>Tests the official ZuzuCord Supabase endpoint and the GitHub update service. Only connection status and round-trip times are displayed.</p>
            </div></div>
          <button type="button" className="button button-subtle" disabled={networkBusy}
            onClick={()=>void testNetwork()}><RefreshCw size={15}/>
            {networkBusy?'Checking…':'Test connections'}</button>
          {network&&<div className="settings-network-results">
            {Object.entries(network.targets).map(([name,result])=><div key={name}>
              <span>{name==='supabase'?'Accounts & messaging':'GitHub releases'}</span>
              <strong className={result.reachable?'reachable':'unreachable'}>
                {result.reachable?'Connected':'Unreachable'}
                {result.latencyMs!=null?' · '+result.latencyMs+' ms':''}
              </strong>
            </div>)}
            <small>Last tested: {new Date(network.checkedAt).toLocaleTimeString()}</small>
          </div>}
        </div>
      </Section>}
      {page==='developer-tools'&&roles.includes('developer')&&<Section
        eyebrow="VERIFIED DEVELOPER" title="Developer Portal"
        description="Manage bot applications, developer-issued Crystals and official announcements inside ZuzuCord.">
        <div className="settings-note"><ShieldCheck size={19}/> Access is verified again with Supabase when you open the portal. A client-side badge alone never grants developer privileges.</div>
        <button className="button button-primary" onClick={onOpenDeveloper}>
          <KeyRound size={16}/> Open Developer Workspace</button>
      </Section>}
      {page==='about'&&<Section eyebrow="ABOUT ZUZUCORD" title="Why choose ZuzuCord?"
        description="An independent community platform with customizable Windows, macOS and Linux clients.">
        <div className="settings-advantages">
          <article><Palette size={20}/><strong>More control over the look</strong>
            <p>OLED palettes, multi-layer gradients, accent colors, animated backgrounds and custom profile banners.</p></article>
          <article><Users size={20}/><strong>Your own community spaces</strong>
            <p>Channels, server roles, custom bots and a developer area managed in the same app.</p></article>
          <article><Sparkles size={20}/><strong>Crystals and Socials</strong>
            <p>Non-purchasable server boosts, personal posts and Moments, bookmarks and creator activity.</p></article>
          <article><RefreshCw size={20}/><strong>Desktop app across platforms</strong>
            <p>Windows supports installed-app updates. macOS and Linux use downloadable releases while their updater support is being validated.</p></article>
        </div>
        <p className="tiny muted">ZuzuCord is not affiliated with Discord. These are project features, not a claim that ZuzuCord is safer or better for everyone. Voice calling and feature parity are still under development.</p>
      </Section>}
      {page==='updates'&&<Section eyebrow="DESKTOP APP" title="Updates"
        description="ZuzuCord installs once and downloads future official updates automatically.">
        <div className="settings-updates-panel"><div><Monitor size={24}/><h3>Installed ZuzuCord</h3>
          <p>Version {version||'Checking…'}</p></div>
          <div className="settings-update-status"><strong>{updateState.phase==='ready'?'Ready to install':
            updateState.phase==='downloading'?'Downloading '+updateState.percent+'%':
            updateState.phase==='current'?'Up to date':
            updateState.phase==='checking'?'Checking for updates':
            updateState.phase==='error'?'Update check failed':'Automatic updates'}</strong>
            <p>{updateState.message||'Official versioned GitHub releases are checked in the background.'}</p>
            {updateState.phase==='downloading'&&<div className="settings-update-progress"><span style={{width:updateState.percent+'%'}}/></div>}
            {updateState.phase==='ready'?<button className="button button-primary" onClick={()=>void onRestartUpdate()}>
              <RefreshCw size={16}/> Restart & Install</button>:
              <button className="button button-subtle" onClick={()=>void onCheckUpdates()}>
                <RefreshCw size={16}/> Check for updates</button>}</div></div>
        <p className="tiny muted">{platform==='win32'?'Windows NSIS installs downloaded updates when the app closes or you restart it. Portable ZIP builds do not auto-update.':'On macOS and Linux, use the published GitHub release packages for manual updates; automatic installation is not enabled.'}</p>
         {platform!=='win32'&&<button className="button button-subtle" type="button"
           onClick={()=>void window.zuzuDesktop?.openOfficialLink('releases')}>Open GitHub releases <ExternalLink size={15}/></button>}
      </Section>}
      {page==='connections'&&<Section eyebrow="CLOUD PREFERENCES" title="Website Sync"
        description="Sync OLED themes, gradients and your preferred server with your ZuzuCord account.">
        <div className="settings-stack"><Tile title="Account appearance sync"
          description="Sync supported colors and gradients between your account and website. Advanced layout options stay on each device.">
          <Toggle on={appearance.sync_enabled} label="Website sync"
            change={v=>void onAppearance({...appearance,sync_enabled:v})}/></Tile>
          <Tile title="Import website theme" description="Load your existing website colors into the theme editor.">
            <SettingButton disabled={busy} onClick={()=>void (async()=>{
              await downloadTheme();setPage('appearance');
            })()}><Cloud size={16}/> Import</SettingButton></Tile></div>
        <div className="settings-note"><Cloud size={18}/> Website sync saves appearance and preferred server. It does not sync passwords, private messages, or device secrets.</div>
      </Section>}
      {page==='server-tools'&&<Section eyebrow="COMMUNITY MANAGEMENT" title="Server Tools"
        description="Configure roles, permissions and server boosts using ZuzuCord's secured backend.">
        <div className="settings-stack"><Tile title="Server roles"
          description={hasServer?'Edit roles and members in '+serverName+'.':'Choose a server first to manage its roles.'}>
          <SettingButton disabled={!hasServer} onClick={onOpenServerRoles}><Users size={16}/> Open roles</SettingButton></Tile>
          <Tile title="Crystals & boosts" description="View Crystal balance, boost levels and unlocked community customization.">
            <SettingButton onClick={onOpenCrystals}><Gem size={16}/> Open wallet</SettingButton></Tile></div>
        <div className="settings-note"><ShieldCheck size={18}/> Server-owner powers are checked on Supabase. Being a ZuzuCord platform developer does not grant access to someone else's server.</div>
      </Section>}
      {feedback&&<div role={failed?'alert':'status'} className={'settings-feedback '+(failed?'error':'ok')}>
        {failed?<Shield size={15}/>:<Check size={15}/>} {feedback}
        <button onClick={()=>setFeedback('')} aria-label="Dismiss message"><X size={14}/></button></div>}
      <footer className="settings-content-footer">ZuzuCord for {systemLabel} · Independent community application</footer>
      </div>
    </main>
  </div>;
}
