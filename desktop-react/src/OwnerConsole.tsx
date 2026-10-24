import { useEffect, useState } from 'react';
import { Crown, Settings2, ShieldCheck } from 'lucide-react';
import { appApi } from './api';
import { watchTables } from './live';

type EditableRole = 'developer' | 'verified' | 'beta_tester';
type Feature = 'attachments' | 'direct_messages' | 'friend_requests' | 'server_messages' | 'social_posts';
type Rule = {feature:string;target_user:string|null;enabled:boolean;updated_at:string};
const FEATURES: Array<{id:Feature;label:string;description:string}> = [
  {id:'attachments',label:'File attachments',description:'Images, PDFs, audio, video and documents'},
  {id:'direct_messages',label:'Direct messages',description:'Private one-to-one messages'},
  {id:'friend_requests',label:'Friend requests',description:'Allow sending new friendship requests'},
  {id:'server_messages',label:'Server conversations',description:'Text conversations in servers'},
  {id:'social_posts',label:'Social posts',description:'Publish new posts to the social feed'}
];

export function OwnerConsole() {
  const [accounts,setAccounts]=useState<Array<{user_id:string;username:string;created_at:string;roles:string[]}>>([]);
  const [accountSearch,setAccountSearch]=useState('');
  const [page,setPage]=useState(0);
  const [directoryBusy,setDirectoryBusy]=useState(true);
  const [directoryLive,setDirectoryLive]=useState(false);
  const [username,setUsername]=useState('');
  const [role,setRole]=useState<EditableRole>('verified');
  const [enable,setEnable]=useState(true);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [rules,setRules]=useState<Rule[]>([]);
  const [feature,setFeature]=useState<Feature>('attachments');
  const [scope,setScope]=useState<'everyone'|'user'>('everyone');
  const [featureUser,setFeatureUser]=useState('');
  const [featureChoice,setFeatureChoice]=useState<'allow'|'block'|'default'>('block');
  const reload=async()=>{
    try{setRules(await appApi.getFeatureRules());}
    catch(e){setError(e instanceof Error?e.message:String(e));}
  };
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{try{const rows=await appApi.ownerAccounts(accountSearch,page);if(active){setAccounts(rows);setDirectoryBusy(false);}}
      catch(e){if(active){setError(e instanceof Error?e.message:String(e));setDirectoryBusy(false);}}};
    setDirectoryBusy(true);
    const stop=watchTables('owner-directory',['zuzucord_accounts','zuzucord_user_roles'],()=>void refresh(),setDirectoryLive);
    return ()=>{active=false;stop();};
  },[accountSearch,page]);
  useEffect(()=>watchTables('owner-rules',['zuzucord_feature_rules'],()=>void reload()),[]);
  const update=async(event:React.FormEvent)=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const target=await appApi.findUser(username.trim().toLowerCase());
      if(!target)throw Error('No matching ZuzuCord account exists.');
      if(!window.confirm((enable?'Grant ':'Revoke ')+role+' for '+target.username+'?'))return;
      await appApi.managePlatformRole(target.user_id,role,enable);
      setNotice('Role '+(enable?'granted':'revoked')+' for '+target.username+'. The account will refresh its privileges.');
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  };
  const changeFeature=async(event:React.FormEvent)=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      let targetId:string|null=null;
      if(scope==='user'){
        const target=await appApi.findUser(featureUser.trim().toLowerCase());
        if(!target)throw Error('Target user not found.');
        targetId=target.user_id;
      }
      const value=featureChoice==='default'?null:featureChoice==='allow';
      const subject=scope==='everyone'?'all accounts':featureUser.trim();
      if(!window.confirm('Apply '+feature+' setting to '+subject+'?'))return;
      await appApi.setFeatureRule(feature,targetId,value);
      await reload();
      setNotice('Feature policy saved for '+subject+'. New writes are checked by the database.');
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  };
  return <div className="modal-body owner-console">
    <div className="owner-banner"><Crown size={28}/><div><strong>ZuzuCord Owner</strong>
      <small>Verified owner permissions · enforced by Supabase</small></div></div>
    <p className="muted">Manage developer access, badges, and live feature availability. Server owners retain control of their own community roles.</p>
    <section className="owner-directory"><h3>Account directory <span className={'live-indicator '+(directoryLive?'connected':'')}>{directoryLive?'Live':'Connecting…'}</span></h3>
      <p className="tiny muted">All ZuzuCord accounts, newest first. Select an account to manage its platform roles.</p>
      <label className="owner-directory-search">Search accounts<input aria-label="Search accounts" placeholder="Username" maxLength={48} value={accountSearch}
        onChange={e=>{setAccountSearch(e.target.value);setPage(0);}}/></label>
      {directoryBusy?<p role="status">Loading accounts…</p>:accounts.length===0?<p>No matching accounts.</p>:accounts.map(account=><div className="owner-account-row" key={account.user_id}>
        <div><strong>{account.username}</strong><small>{account.roles.join(' · ')||'Member'} · Joined {new Date(account.created_at).toLocaleDateString()}</small><small>{account.user_id}</small></div>
        <button className="button button-subtle" onClick={()=>setUsername(account.username)}>Manage</button></div>)}
      <div className="owner-directory-pages"><button className="button button-subtle" disabled={page===0||directoryBusy} onClick={()=>setPage(p=>p-1)}>Previous</button>
        <span>Page {page+1}</span><button className="button button-subtle" disabled={accounts.length<50||directoryBusy} onClick={()=>setPage(p=>p+1)}>Next</button></div>
    </section>
    <h3 className="owner-section-title"><ShieldCheck size={18}/> Developer accounts and badges</h3>
    <form onSubmit={e=>void update(e)} className="owner-role-form">
      <label>Target username<input required placeholder="ZuzuCord username" value={username}
        onChange={e=>setUsername(e.target.value)} autoComplete="off"/></label>
      <label>Platform permission<select value={role} onChange={e=>setRole(e.target.value as EditableRole)}>
        <option value="verified">Verified</option><option value="beta_tester">Beta tester</option>
        <option value="developer">Developer (bots, announcements, Crystals)</option></select></label>
      <label>Action<select value={enable?'grant':'revoke'} onChange={e=>setEnable(e.target.value==='grant')}>
        <option value="grant">Grant permission</option><option value="revoke">Revoke permission</option></select></label>
      <button disabled={busy} className="button button-primary"><ShieldCheck size={17}/>{busy?'Saving…':'Apply role change'}</button>
    </form>
    <section className="owner-feature-section">
      <h3 className="owner-section-title"><Settings2 size={18}/> Feature controls</h3>
      <p className="tiny muted">Rules take effect on the database, not just visually. User-specific overrides take priority over the global setting. Reset removes the override.</p>
      <div className="owner-feature-grid">{FEATURES.map(item=>{
        const global=rules.find(r=>r.feature===item.id&&r.target_user===null);
        const blocked=rules.filter(r=>r.feature===item.id&&r.target_user!==null&&!r.enabled).length;
        return <div className="owner-feature-card" key={item.id}>
          <strong>{item.label}</strong><small>{item.description}</small>
          <span className={global?.enabled===false?'feature-state-off':'feature-state-on'}>
            {global?.enabled===false?'Disabled globally':'Available by default'}
          </span><small>{blocked} user-specific blocks</small>
        </div>;
      })}</div>
      <form onSubmit={e=>void changeFeature(e)} className="owner-role-form owner-feature-form">
        <label>Feature<select value={feature} onChange={e=>setFeature(e.target.value as Feature)}>
          {FEATURES.map(item=><option value={item.id} key={item.id}>{item.label}</option>)}
        </select></label>
        <label>Apply to<select value={scope} onChange={e=>setScope(e.target.value as 'everyone'|'user')}>
          <option value="everyone">Everyone (global)</option><option value="user">One user</option></select></label>
        {scope==='user'&&<label>User<input value={featureUser} onChange={e=>setFeatureUser(e.target.value)}
          required placeholder="Username" autoComplete="off"/></label>}
        <label>Policy<select value={featureChoice} onChange={e=>setFeatureChoice(e.target.value as 'allow'|'block'|'default')}>
          <option value="allow">Enable feature</option><option value="block">Disable feature</option>
          <option value="default">Reset to inherited default</option></select></label>
        <button disabled={busy} className="button button-primary"><Settings2 size={17}/>{busy?'Saving…':'Save feature rule'}</button>
      </form>
    </section>
    {notice&&<p className="success-line" role="status">{notice}</p>}
    {error&&<p className="error-line" role="alert">{error}</p>}
    <p className="tiny muted">Platform actions require verified Owner access. No account may be forced into a friendship; pending requests remain subject to recipient approval.</p>
  </div>;
}
