import { useState } from 'react';
import { Crown, ShieldCheck, Users } from 'lucide-react';
import { appApi } from './api';
type EditableRole = 'developer' | 'verified' | 'beta_tester';
export function OwnerConsole() {
  const [username,setUsername]=useState('');
  const [role,setRole]=useState<EditableRole>('verified');
  const [enable,setEnable]=useState(true);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const update=async(event:React.FormEvent)=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const target=await appApi.findUser(username.trim().toLowerCase());
      if(!target)throw Error('No matching ZuzuCord account exists.');
      if(!window.confirm((enable?'Grant ':'Revoke ')+role+' for '+target.username+'?'))return;
      await appApi.managePlatformRole(target.user_id,role,enable);
      setNotice('Role '+(enable?'granted':'revoked')+' for '+target.username+'. Refresh account data to see the badge.');
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  };
  return <div className="modal-body owner-console">
    <div className="owner-banner"><Crown size={28}/><div><strong>ZuzuCord Owner</strong>
      <small>Verified owner permissions · enforced by Supabase</small></div></div>
    <p className="muted">Manage developer access and verified or beta-tester badges for existing ZuzuCord accounts. The Owner title cannot be granted from this console.</p>
    <form onSubmit={e=>void update(e)} className="owner-role-form">
      <label>Target username<input required placeholder="ZuzuCord username" value={username}
        onChange={e=>setUsername(e.target.value)} autoComplete="off"/></label>
      <label>Platform permission<select value={role} onChange={e=>setRole(e.target.value as EditableRole)}>
        <option value="verified">Verified</option><option value="beta_tester">Beta tester</option>
        <option value="developer">Developer</option></select></label>
      <label>Action<select value={enable?'grant':'revoke'} onChange={e=>setEnable(e.target.value==='grant')}>
        <option value="grant">Grant permission</option><option value="revoke">Revoke permission</option></select></label>
      <button disabled={busy} className="button button-primary"><ShieldCheck size={17}/>{busy?'Saving…':'Apply role change'}</button>
    </form>
    {notice&&<p className="success-line" role="status">{notice}</p>}
    {error&&<p className="error-line" role="alert">{error}</p>}
    <p className="tiny muted">Only trusted owners should delegate developer access. Role changes are validated again by the server. Server Owner rights remain with each server's creator.</p>
  </div>;
}
