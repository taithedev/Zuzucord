import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Bot, Check, ChevronLeft, Copy, KeyRound, Plus, RotateCcw,
  ShieldCheck, Sparkles, Trash2, Users } from 'lucide-react';
import { client } from './api';

type BotApp={id:string;name:string;description:string;created_at:string};
export function DeveloperWorkspace({userId,onClose}:{userId:string;onClose:()=>void}){
  const [authorized,setAuthorized]=useState(false);
  const [checking,setChecking]=useState(true);
  const [apps,setApps]=useState<BotApp[]>([]);
  const [name,setName]=useState('');
  const [description,setDescription]=useState('');
  const [notice,setNotice]=useState('');
  const [token,setToken]=useState('');
  const [busy,setBusy]=useState(false);
  const [recipient,setRecipient]=useState('');
  const [amount,setAmount]=useState(100);
  const [title,setTitle]=useState('');
  const [message,setMessage]=useState('');
  const errorString=(e:unknown)=>e instanceof Error?e.message:String(e);
  const check=useCallback(async()=>{
    setChecking(true);
    try{
      const {data,error}=await client.rpc('zuzucord_has_role',{p_role:'developer'});
      if(error)throw error;
      setAuthorized(data===true);
      if(data!==true)throw Error('Only authorized ZuzuCord developers can open this workspace.');
      const {data:items,error:listError}=await client.from('zuzucord_bot_apps')
        .select('id,name,description,created_at').eq('owner_id',userId)
        .order('created_at',{ascending:false}).limit(100);
      if(listError)throw listError;
      setApps(items||[]);
    }catch(e){setAuthorized(false);setNotice(errorString(e));}
    finally{setChecking(false);}
  },[userId]);
  useEffect(()=>{void check();return ()=>setToken('');},[check]);
  const createBot=async(e:FormEvent)=>{
    e.preventDefault();if(!authorized||busy)return;
    setBusy(true);
    try{
      const {error}=await client.from('zuzucord_bot_apps').insert({
        owner_id:userId,name:name.trim(),description:description.trim()
      });
      if(error)throw error;
      setName('');setDescription('');setNotice('Bot application created.');
      await check();
    }catch(e){setNotice(errorString(e));}
    finally{setBusy(false);}
  };
  const credential=async(id:string,action:'issue'|'revoke')=>{
    if(!authorized||busy)return;
    if(!confirm(action==='issue'?
      'Generate a new bot token? Any existing token will be revoked.':
      'Revoke the bot token now? This will disconnect that bot.'))return;
    setBusy(true);setToken('');
    try{
      const {data,error}=await client.functions.invoke('zuzucord-bot-api',{
        body:{action,bot_id:id}
      });
      if(error)throw error;
      if(data?.error)throw Error(String(data.error));
      if(action==='issue' && typeof data?.token!=='string')throw Error('No token returned.');
      setToken(data?.token||'');
      setNotice(action==='issue'?'Copy this token once and store it securely.':'Token revoked.');
    }catch(e){setNotice(errorString(e));}
    finally{setBusy(false);}
  };
  const grant=async(e:FormEvent)=>{
    e.preventDefault();if(!authorized||busy)return;
    setBusy(true);
    try{
      let id=recipient.trim();
      if(!/^[0-9a-f-]{36}$/i.test(id)){
        const username=id.toLowerCase().replace(/@zuzucord\.com$/,'');
        if(!/^[a-z0-9_]{3,24}$/.test(username))throw Error('Enter a valid username or user ID.');
        const {data,error}=await client.rpc('zuzucord_find_username',{p_username:username});
        if(error)throw error;
        if(!data?.[0]?.user_id)throw Error('No account matches that username.');
        id=data[0].user_id;
      }
      if(!Number.isInteger(amount)||amount<1||amount>1000)throw Error('Grant 1–1,000 Crystals.');
      if(!confirm('Grant '+amount+' Crystals? This action is recorded.'))return;
      const {data,error}=await client.rpc('zuzucord_grant_crystals',{p_user:id,p_amount:amount});
      if(error)throw error;
      setNotice('Crystals granted. New balance: '+data);
      setRecipient('');
    }catch(e){setNotice(errorString(e));}
    finally{setBusy(false);}
  };
  const publish=async(e:FormEvent)=>{
    e.preventDefault();if(!authorized||busy)return;
    if(!confirm('Publish this official message to all ZuzuCord accounts?'))return;
    setBusy(true);
    try{
      const {error}=await client.rpc('zuzucord_publish_announcement',{
        p_title:title.trim(),p_content:message.trim()
      });
      if(error)throw error;
      setNotice('Official announcement published.');setTitle('');setMessage('');
    }catch(e){setNotice(errorString(e));}
    finally{setBusy(false);}
  };
  return <div className="developer-workspace" role="dialog" aria-modal="true" aria-label="Developer workspace">
    <header className="developer-workspace-header">
      <button onClick={onClose} aria-label="Back to ZuzuCord"><ChevronLeft size={20}/> Back</button>
      <div><span>AUTHORIZED WORKSPACE</span><h2>ZuzuCord Developer</h2></div>
      <span className="developer-workspace-status"><ShieldCheck size={16}/>{checking?'Verifying…':authorized?'Verified developer':'No access'}</span>
    </header>
    {checking?<p className="developer-workspace-empty">Checking your role with Supabase…</p>:
      !authorized?<div className="developer-workspace-empty"><ShieldCheck size={30}/>
        <h3>Developer permission required</h3>
        <p>{notice||'Ask an authorized owner to grant developer access.'}</p>
        <button className="button button-subtle" onClick={onClose}>Return to app</button></div>:
      <div className="developer-workspace-scroll">
        <p className="developer-workspace-intro">Build ZuzuCord bots, issue developer-only Crystals and publish official updates. Every action is checked on Supabase.</p>
        {notice&&<p className="developer-workspace-notice" role="status">{notice}</p>}
        {token&&<div className="developer-workspace-token">
          <strong><KeyRound size={16}/> Newly created bot token (displayed once)</strong>
          <code>{token}</code>
          <div><button onClick={()=>void navigator.clipboard.writeText(token).then(()=>setNotice('Token copied. Keep it in server-side environment variables.'))}><Copy size={15}/> Copy</button>
          <button onClick={()=>setToken('')}>Hide token</button></div>
          <small>Never paste bot credentials into a website, chat message, screenshot, or repository.</small></div>}
        <div className="developer-workspace-layout">
          <section className="developer-panel">
            <div className="developer-panel-heading"><Bot size={20}/><h3>Bot applications</h3><span>{apps.length} apps</span></div>
            <form className="developer-form" onSubmit={e=>void createBot(e)}>
              <label>Bot name<input value={name} minLength={3} maxLength={40} required
                onChange={e=>setName(e.target.value)} placeholder="My ZuzuCord bot"/></label>
              <label>Description<input value={description} maxLength={240}
                onChange={e=>setDescription(e.target.value)} placeholder="What does your bot do?"/></label>
              <button className="button button-primary" disabled={busy}><Plus size={16}/> Create application</button>
            </form>
            <div className="developer-bots">{apps.length===0?<p>No bot applications yet.</p>:
              apps.map(bot=><article key={bot.id}>
                <strong>{bot.name}</strong><p>{bot.description||'No description provided'}</p>
                <small>{bot.id}</small>
                <div><button onClick={()=>void credential(bot.id,'issue')} disabled={busy}>
                  <RotateCcw size={15}/> Issue / rotate token</button>
                <button onClick={()=>void credential(bot.id,'revoke')} disabled={busy}>
                  <Trash2 size={15}/> Revoke</button></div>
              </article>)}</div>
          </section>
          <div className="developer-workspace-aside">
            <section className="developer-panel">
              <div className="developer-panel-heading"><Sparkles size={19}/><h3>Grant Crystals</h3></div>
              <form className="developer-form" onSubmit={e=>void grant(e)}>
                <label>Account username<input required value={recipient}
                  onChange={e=>setRecipient(e.target.value)} placeholder="username@zuzucord.com"/></label>
                <label>Crystals<input type="number" min={1} max={1000} required value={amount}
                  onChange={e=>setAmount(Number(e.target.value))}/></label>
                <button disabled={busy} className="button button-subtle">Grant securely</button>
              </form>
            </section>
            <section className="developer-panel">
              <div className="developer-panel-heading"><Users size={19}/><h3>Official announcements</h3></div>
              <form className="developer-form" onSubmit={e=>void publish(e)}>
                <label>Title<input minLength={3} maxLength={90} required value={title}
                  onChange={e=>setTitle(e.target.value)} placeholder="Product update"/></label>
                <label>Message<textarea minLength={2} maxLength={1500} rows={4} required value={message}
                  onChange={e=>setMessage(e.target.value)}/></label>
                <button disabled={busy} className="button button-subtle"><Check size={16}/> Publish</button>
              </form>
            </section>
          </div>
        </div>
      </div>}
  </div>;
}