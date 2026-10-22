import {useEffect,useState,type CSSProperties,type ChangeEvent,type FormEvent} from 'react';
import {Camera,Check,Image as ImageIcon,Palette,Save,Shield} from 'lucide-react';
import {client} from './api';

const bucket='zuzucord-profile-media';
const allowed:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
const maxBytes=5*1024*1024;
type Profile = {display_name:string;status_text:string;avatar_url:string|null;
 banner_path:string|null;bio:string;pronouns:string;profile_accent:string};
export function ProfileStudio({userId,username,onBasicSaved,onAvatarSaved}:{
  userId:string;username:string;
  onBasicSaved:(displayName:string,status:string)=>Promise<void>;
  onAvatarSaved:(signedAvatar:string|null)=>void;
}){
  const [profile,setProfile]=useState<Profile>({
    display_name:username,status_text:'',avatar_url:null,banner_path:null,
    bio:'',pronouns:'',profile_accent:'#a978ff'
  });
  const [avatarFile,setAvatarFile]=useState<File|null>(null);
  const [bannerFile,setBannerFile]=useState<File|null>(null);
  const [avatarPreview,setAvatarPreview]=useState('');
  const [bannerPreview,setBannerPreview]=useState('');
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;let a='',b='';
    (async()=>{
      try{
        const {data,error}=await client.from('zuzucord_profiles')
          .select('display_name,status_text,avatar_url,banner_path,bio,pronouns,profile_accent')
          .eq('user_id',userId).maybeSingle();
        if(error)throw error;
        if(!active)return;
        if(data)setProfile({
          display_name:data.display_name||username,status_text:data.status_text||'',
          avatar_url:data.avatar_url||null,banner_path:data.banner_path||null,
          bio:data.bio||'',pronouns:data.pronouns||'',profile_accent:data.profile_accent||'#a978ff'
        });
        if(data?.avatar_url){
          const {data:link}=await client.storage.from(bucket).createSignedUrl(data.avatar_url,1800);
          if(active){a=link?.signedUrl||'';setAvatarPreview(a);}
        }
        if(data?.banner_path){
          const {data:link}=await client.storage.from(bucket).createSignedUrl(data.banner_path,1800);
          if(active){b=link?.signedUrl||'';setBannerPreview(b);}
        }
      }catch(e){if(active)setStatus(e instanceof Error?e.message:String(e));}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[userId,username]);
  useEffect(()=>{
    if(!avatarFile)return;
    const url=URL.createObjectURL(avatarFile);setAvatarPreview(url);
    return()=>URL.revokeObjectURL(url);
  },[avatarFile]);
  useEffect(()=>{
    if(!bannerFile)return;
    const url=URL.createObjectURL(bannerFile);setBannerPreview(url);
    return()=>URL.revokeObjectURL(url);
  },[bannerFile]);
  const pick=(event:ChangeEvent<HTMLInputElement>,kind:'avatar'|'banner')=>{
    const file=event.target.files?.[0];if(!file)return;
    if(!allowed[file.type]){setStatus('Choose a JPEG, PNG or WebP image.');return;}
    if(file.size>maxBytes){setStatus('Profile images must be 5 MB or smaller.');return;}
    if(kind==='avatar')setAvatarFile(file);else setBannerFile(file);
    setStatus('');event.target.value='';
  };
  const save=async(event:FormEvent)=>{
    event.preventDefault();if(busy)return;
    const name=profile.display_name.trim();
    if(!name||name.length>40){setStatus('Display name must have 1–40 characters.');return;}
    setBusy(true);setStatus('');
    const uploaded:string[]=[];
    try{
      const updated={...profile};
      for(const [kind,file] of [['avatar',avatarFile],['banner',bannerFile]] as const){
        if(!file)continue;
        const path=userId+'/'+kind+'-'+crypto.randomUUID()+'.'+allowed[file.type];
        const {error}=await client.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});
        if(error)throw error;
        uploaded.push(path);
        if(kind==='avatar')updated.avatar_url=path;else updated.banner_path=path;
      }
      const {error}=await client.from('zuzucord_profiles').upsert({
        user_id:userId,display_name:name,status_text:updated.status_text.trim().slice(0,120),
        avatar_url:updated.avatar_url,banner_path:updated.banner_path,
        bio:updated.bio.trim().slice(0,450),pronouns:updated.pronouns.trim().slice(0,40),
        profile_accent:updated.profile_accent,updated_at:new Date().toISOString()
      },{onConflict:'user_id'});
      if(error)throw error;
      await onBasicSaved(name,updated.status_text);
      setProfile(updated);setAvatarFile(null);setBannerFile(null);
      if(updated.avatar_url){
        const {data}=await client.storage.from(bucket).createSignedUrl(updated.avatar_url,1800);
        onAvatarSaved(data?.signedUrl||null);
        if(data?.signedUrl)setAvatarPreview(data.signedUrl);
      }
      if(updated.banner_path){
        const {data}=await client.storage.from(bucket).createSignedUrl(updated.banner_path,1800);
        if(data?.signedUrl)setBannerPreview(data.signedUrl);
      }
      // Remove replaced files only after the new profile references are saved.
      const oldImages=[profile.avatar_url!==updated.avatar_url?profile.avatar_url:null,
       profile.banner_path!==updated.banner_path?profile.banner_path:null].filter((p):p is string=>Boolean(p));
      if(oldImages.length)void client.storage.from(bucket).remove(oldImages);
      setStatus('Profile, photos and banner saved.');
    }catch(e){
      if(uploaded.length)void client.storage.from(bucket).remove(uploaded);
      setStatus(e instanceof Error?e.message:String(e));
    }finally{setBusy(false);}
  };
  return <form className="profile-studio" onSubmit={e=>void save(e)}>
    <div className="profile-studio-preview" style={{'--profile-accent':profile.profile_accent} as CSSProperties}>
      <div className="profile-studio-banner" style={bannerPreview?{backgroundImage:'url('+JSON.stringify(bannerPreview)+')'}:undefined}>
        <label className="profile-studio-banner-upload"><ImageIcon size={15}/> Change banner
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden
            onChange={e=>pick(e,'banner')}/></label>
      </div>
      <div className="profile-studio-avatar" style={avatarPreview?{
        backgroundImage:'url('+JSON.stringify(avatarPreview)+')'}:undefined}>
        {!avatarPreview&&username.slice(0,2).toUpperCase()}
        <label className="profile-studio-avatar-upload" title="Change profile picture">
          <Camera size={16}/><input type="file" accept="image/png,image/jpeg,image/webp" hidden
            onChange={e=>pick(e,'avatar')}/></label>
      </div>
      <div className="profile-studio-preview-details">
        <h3>{profile.display_name||username}</h3>
        <small>@{username}</small>
        <p>{profile.bio||profile.status_text||'Make your profile your own.'}</p>
      </div>
    </div>
    <div className="profile-studio-fields">
      <label>Display name<input maxLength={40} required value={profile.display_name}
        onChange={e=>setProfile(p=>({...p,display_name:e.target.value}))}/></label>
      <label>Status message<input maxLength={120} value={profile.status_text}
        onChange={e=>setProfile(p=>({...p,status_text:e.target.value}))}/></label>
      <label>About me<textarea maxLength={450} rows={3} value={profile.bio}
        placeholder="Your interests, projects, and communities"
        onChange={e=>setProfile(p=>({...p,bio:e.target.value}))}/></label>
      <label>Pronouns (optional)<input maxLength={40} value={profile.pronouns}
        onChange={e=>setProfile(p=>({...p,pronouns:e.target.value}))}/></label>
      <label className="profile-studio-accent"><Palette size={17}/> Profile accent
        <input type="color" value={profile.profile_accent}
          onChange={e=>setProfile(p=>({...p,profile_accent:e.target.value}))}/></label>
      <p className="profile-studio-note"><Shield size={15}/> Profile images are visible to signed-in ZuzuCord members. Avoid posting sensitive personal information.</p>
      <button className="button button-primary" disabled={busy||loading} type="submit">
        {busy?<Save size={16}/>:<Check size={16}/>}
        {busy?'Saving profile…':loading?'Loading profile…':'Save profile changes'}
      </button>
      {status&&<p role="status" className="profile-studio-status">{status}</p>}
    </div>
  </form>;
}