import { useState } from 'react';
import { appApi, type Server, type Channel } from './api';

async function readIcon(file:File):Promise<string> {
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Choose a PNG, JPEG or WebP under 8 MB.');
  const bitmap=await createImageBitmap(file);
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();throw Error('Image processing is unavailable.');}
  const side=Math.min(bitmap.width,bitmap.height);
  ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,128,128);bitmap.close();
  return canvas.toDataURL('image/webp',.85);
}
function ChannelEditor({channel,onSaved}:{channel:Channel;onSaved:()=>void}) {
  const [name,setName]=useState(channel.name),[topic,setTopic]=useState(channel.description||'');
  const [category,setCategory]=useState(channel.category||'Text channels'),[position,setPosition]=useState(channel.position||0);
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  return <form className="channel-edit-card" onSubmit={async e=>{e.preventDefault();setBusy(true);setNotice('');
    try{await appApi.saveChannel(channel.id,name,topic,category,position);setNotice('Channel saved.');onSaved();}
    catch(error){setNotice(error instanceof Error?error.message:String(error));}finally{setBusy(false);}}}>
    <label>Channel name<input required maxLength={48} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Topic<input maxLength={240} value={topic} onChange={e=>setTopic(e.target.value)}/></label>
    <label>Category<input required maxLength={48} value={category} onChange={e=>setCategory(e.target.value)}/></label>
    <label>Sort position<input type="number" min={0} max={999} required value={position} onChange={e=>setPosition(Number(e.target.value))}/></label>
    <button className="button button-subtle" disabled={busy}>{busy?'Saving…':'Save channel'}</button>
    {notice&&<p role="status">{notice}</p>}
  </form>;
}
export function ServerSettings({server,channels,onSaved}:{server:Server;channels:Channel[];onSaved:()=>void}) {
  const [name,setName]=useState(server.name),[description,setDescription]=useState(server.description||'');
  const [icon,setIcon]=useState(server.icon_url||''),[accent,setAccent]=useState(server.accent_color||'#5865f2');
  const [gradient,setGradient]=useState(server.gradient_color||'#231330'),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  return <div className="modal-body server-settings"><form onSubmit={async e=>{e.preventDefault();setBusy(true);setNotice('');
    try{await appApi.saveServer(server.id,name,description,icon,accent,gradient);await onSaved();setNotice('Server updated for all members.');}
    catch(error){setNotice(error instanceof Error?error.message:String(error));}finally{setBusy(false);}}}>
    <div className="server-brand-preview" style={{background:`linear-gradient(120deg,${accent},${gradient})`}}>
      <div className="server-icon-preview">{icon?<img src={icon} alt="Server icon"/>:name.slice(0,2).toUpperCase()}</div><strong>{name}</strong></div>
    <label>Server icon<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{
      const file=e.target.files?.[0];if(!file)return;try{setIcon(await readIcon(file));}catch(error){setNotice(String(error));}e.target.value='';}}/></label>
    <button type="button" className="button button-subtle" onClick={()=>setIcon('')}>Remove icon</button>
    <label>Server name<input required maxLength={48} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Description<textarea maxLength={240} value={description} onChange={e=>setDescription(e.target.value)}/></label>
    <div className="server-colors"><label>Accent<input type="color" value={accent} onChange={e=>setAccent(e.target.value)}/></label>
      <label>Banner gradient<input type="color" value={gradient} onChange={e=>setGradient(e.target.value)}/></label></div>
    <button className="button button-primary" disabled={busy}>{busy?'Saving…':'Save server'}</button>
    {notice&&<p role="status">{notice}</p>}
  </form><h3>Channels & categories</h3><p className="muted tiny">Rename channels, write topics, group categories and set their order. Members receive changes live.</p>
    {channels.map(channel=><ChannelEditor key={channel.id} channel={channel} onSaved={()=>{}}/>)}</div>;
}
