import { useCallback, useEffect, useState } from 'react';
import { Check, Crown, Plus, Shield, Trash2, Users } from 'lucide-react';
import { appApi, type CustomRoleAssignment, type CustomServerRole, type Member } from './api';

type RoleEdit = {
  name: string; color: string; manage_channels: boolean;
  manage_members: boolean; manage_bots: boolean
};
const INITIAL: RoleEdit = {
  name:'Moderator', color:'#a978ff',
  manage_channels:false, manage_members:false, manage_bots:false
};
export function ServerRolesEditor({ serverId, members, isOwner }: {
  serverId: string; members: Member[]; isOwner: boolean
}) {
  const [roles, setRoles] = useState<CustomServerRole[]>([]);
  const [assignments, setAssignments] = useState<CustomRoleAssignment[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [edit, setEdit] = useState<RoleEdit>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const refresh = useCallback(async()=>{
    const [r,a] = await Promise.all([appApi.getCustomRoles(serverId),appApi.getRoleAssignments(serverId)]);
    setRoles(r);setAssignments(a);
  },[serverId]);
  useEffect(()=>{void refresh().catch(e=>setError(e.message));},[refresh]);
  const choose = (role:CustomServerRole)=>{
    setSelected(role.id);
    setEdit({
      name:role.name,color:role.color,
      manage_channels:role.manage_channels,manage_members:role.manage_members,
      manage_bots:role.manage_bots
    });
    setError('');setMessage('');
  };
  const save=async()=>{
    setLoading(true);setError('');setMessage('');
    try{
      const id=await appApi.saveServerRole(serverId,selected,edit.name,edit.color,{
        manage_channels:edit.manage_channels,manage_members:edit.manage_members,
        manage_bots:edit.manage_bots
      });
      await refresh();setSelected(id);setMessage('Role saved. Permissions apply immediately.');
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setLoading(false);}
  };
  const remove=async()=>{
    if(!selected||!confirm('Delete this custom role and remove its assignments?'))return;
    setLoading(true);setError('');
    try{
      await appApi.deleteServerRole(serverId,selected);
      await refresh();setSelected(null);setEdit(INITIAL);setMessage('Role deleted.');
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setLoading(false);}
  };
  const toggle=async(userId:string,checked:boolean)=>{
    if(!selected)return;
    setLoading(true);setError('');
    try{
      await appApi.assignServerRole(serverId,userId,selected,checked);
      await refresh();setMessage('Member roles updated.');
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setLoading(false);}
  };
  return <div className="roles-editor">
    <section className="role-list">
      <div className="roles-title"><Shield size={17}/> Custom roles <span>{roles.length}/30</span></div>
      <button className={'role-choice '+(!selected?'chosen':'')} onClick={()=>{
        setSelected(null);setEdit(INITIAL);setError('');setMessage('');
      }}><Plus size={16}/> New role</button>
      {roles.map(r=><button className={'role-choice '+(selected===r.id?'chosen':'')} key={r.id}
        onClick={()=>choose(r)}><span className="role-pip" style={{background:r.color}}/>
        <span>{r.name}</span></button>)}
      <div className="role-help">Roles give specific members permissions. The server Owner role cannot be edited or removed.</div>
    </section>
    <section className="role-main">
      <h3>{selected?'Edit role':'Create a role'}</h3>
      <div className="role-form">
        <label>Role name<input value={edit.name} maxLength={32} minLength={2}
          disabled={!isOwner} onChange={e=>setEdit(p=>({...p,name:e.target.value}))}/></label>
        <label>Role color<input type="color" disabled={!isOwner} value={edit.color}
          onChange={e=>setEdit(p=>({...p,color:e.target.value}))}/></label>
        <div className="roles-perms">
          <h4>Permissions</h4>
          {([
            ['manage_channels','Manage Channels','Create and organize community channels'],
            ['manage_members','Manage Members','Remove regular members; never administrators or the Owner'],
            ['manage_bots','Manage Bots','Enable or disable the built-in ZuzuBot']
          ] as const).map(([key,title,description])=>
            <label className="role-permission" key={key}><div><strong>{title}</strong><small>{description}</small></div>
              <input type="checkbox" disabled={!isOwner} checked={edit[key]}
                onChange={e=>setEdit(p=>({...p,[key]:e.target.checked}))}/></label>
          )}
        </div>
        {isOwner && <div className="role-actions">
          <button className="button button-primary" disabled={loading} onClick={()=>void save()}>
            <Check size={16}/>{selected?'Save changes':'Create role'}</button>
          {!!selected && <button className="button button-subtle" disabled={loading} onClick={()=>void remove()}>
            <Trash2 size={16}/>Delete role</button>}
        </div>}
      </div>
      {!!selected && <div className="role-members"><h4><Users size={17}/> Role assignments</h4>
        {members.map(m=><label key={m.user_id} className="role-member">
          <span><strong>{m.username}</strong><small>{m.role==='owner'?'Server owner':m.role}</small></span>
          <input disabled={!isOwner||loading} type="checkbox"
            checked={assignments.some(a=>a.role_id===selected&&a.user_id===m.user_id)}
            onChange={e=>void toggle(m.user_id,e.target.checked)}/>
        </label>)}
      </div>}
      {error && <p role="alert" className="error-line">{error}</p>}
      {message && <p role="status" className="success-line">{message}</p>}
    </section>
  </div>;
}
