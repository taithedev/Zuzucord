import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Camera, Check, ChevronDown, Clock3, Compass, Copy, Film, Heart,
  Image as ImageIcon, MessageCircle, MoreHorizontal, Repeat2, RefreshCw, Send, Sparkles, Trash2,
  UserPlus, Users, X } from 'lucide-react';
import { client } from './api';

type SocialKind = 'post'|'moment';
type Tab = 'feed'|'moments'|'following'|'saved'|'discover'|'hidden'|'reports'|'reshares';
type Post = {id:string;author_id:string;kind:SocialKind;content:string;media_path:string|null;
  media_type:'image'|'video'|null;created_at:string};
type Reaction = {post_id:string;user_id:string};
type Comment = {id:string;post_id:string;author_id:string;content:string;created_at:string};
type Author = {username:string;display_name?:string;avatar_url?:string|null;
 banner_path?:string|null;bio?:string;pronouns?:string;avatarSrc?:string};
const bucket = 'zuzucord-social-media';
const maxUpload = 25 * 1024 * 1024;
const formats:Record<string,string>={
  'image/jpeg':'jpg','image/png':'png','image/webp':'webp',
  'image/gif':'gif','video/mp4':'mp4','video/webm':'webm'
};
const description='Posts and Moments from the ZuzuCord community';
const ago=(date:string)=>{
  const ms=Date.now()-new Date(date).getTime();
  if(!Number.isFinite(ms)||ms<0)return 'Just now';
  if(ms<60000)return 'Just now';
  if(ms<3600000)return Math.floor(ms/60000)+'m';
  if(ms<86400000)return Math.floor(ms/3600000)+'h';
  return new Date(date).toLocaleDateString();
};
const getErr=(error:unknown)=>error instanceof Error?error.message:String(error);
export function SocialsHub({userId,owner,onMessage,onAccountSettings}:{
  userId:string;owner:boolean;onMessage:(message:string)=>void;onAccountSettings:()=>void
}){
  const [tab,setTab]=useState<Tab>('feed');
  const [kind,setKind]=useState<SocialKind>('post');
  const [content,setContent]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState<string|null>(null);
  const [posts,setPosts]=useState<Post[]>([]);
  const [likes,setLikes]=useState<Reaction[]>([]);
  const [reposts,setReposts]=useState<Reaction[]>([]);
  const [selectedCreator,setSelectedCreator]=useState<string|null>(null);
  const [creatorStatus,setCreatorStatus]=useState('');
  const [creatorBanner,setCreatorBanner]=useState('');
  const [creatorBio,setCreatorBio]=useState('');
  const [creatorPronouns,setCreatorPronouns]=useState('');
  const [saved,setSaved]=useState<Set<string>>(new Set());
  const [following,setFollowing]=useState<Set<string>>(new Set());
  const [hiddenCreators,setHiddenCreators]=useState<Set<string>>(new Set());
  const [reports,setReports]=useState<{id:string;post_id:string;reporter_id:string;reason:string;created_at:string}[]>([]);
  const [authors,setAuthors]=useState<Record<string,Author>>({});
  const [mediaUrls,setMediaUrls]=useState<Record<string,string>>({});
  const [comments,setComments]=useState<Record<string,Comment[]>>({});
  const [expanded,setExpanded]=useState<Set<string>>(new Set());
  const [commentDrafts,setCommentDrafts]=useState<Record<string,string>>({});
  const [search,setSearch]=useState('');
  const [sort,setSort]=useState<'recent'|'popular'>('recent');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const fileRef=useRef<HTMLInputElement|null>(null);
  const mounted=useRef(true);

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const [postResult,followResult,hiddenResult]=await Promise.all([
        client.from('zuzucord_social_posts').select('id,author_id,kind,content,media_path,media_type,created_at')
          .order('created_at',{ascending:false}).limit(100),
        client.from('zuzucord_social_follows').select('followed_id').eq('follower_id',userId),
        client.from('zuzucord_social_hidden_creators').select('hidden_user_id').eq('user_id',userId)
      ]);
      if(hiddenResult.error)throw hiddenResult.error;
      if(postResult.error)throw postResult.error;
      if(followResult.error)throw followResult.error;
      const records=(postResult.data||[]) as Post[];
      const postIds=records.map(p=>p.id);
      const likesResult=postIds.length?await client.from('zuzucord_social_likes')
        .select('post_id,user_id').in('post_id',postIds):{data:[],error:null};
      if(likesResult.error)throw likesResult.error;
      const repostResult=postIds.length?await client.from('zuzucord_social_reposts')
        .select('post_id,user_id').in('post_id',postIds):{data:[],error:null};
      if(repostResult.error)throw repostResult.error;
      const savedResult=await client.from('zuzucord_social_bookmarks')
        .select('post_id').eq('user_id',userId);
      if(savedResult.error)throw savedResult.error;
      const users=[...new Set(records.map(p=>p.author_id))];
      const accounts=users.length?await client.from('zuzucord_accounts')
        .select('user_id,username').in('user_id',users):{data:[],error:null};
      if(accounts.error)throw accounts.error;
      const profiles=users.length?await client.from('zuzucord_profiles')
        .select('user_id,display_name,avatar_url,banner_path,bio,pronouns').in('user_id',users):{data:[],error:null};
      const nameMap:Record<string,Author>={};
      for(const account of accounts.data||[])nameMap[account.user_id]={username:account.username};
      if(!profiles.error)for(const person of profiles.data||[]){
        nameMap[person.user_id]={...(nameMap[person.user_id]||{username:'Member'}),
          display_name:person.display_name,avatar_url:person.avatar_url||null,
          banner_path:person.banner_path||null,bio:person.bio||'',pronouns:person.pronouns||''};
      }
      const avatarPaths=[...new Set(Object.values(nameMap).map(a=>a.avatar_url).filter((x):x is string=>Boolean(x)))];
      const avatarLinks=await Promise.all(avatarPaths.map(async path=>{
        const {data}=await client.storage.from('zuzucord-profile-media').createSignedUrl(path,1800);
        return [path,data?.signedUrl||''] as const;
      }));
      const avatarMap=Object.fromEntries(avatarLinks);
      for(const author of Object.values(nameMap)) if(author.avatar_url)author.avatarSrc=avatarMap[author.avatar_url]||'';
      const paths=[...new Set(records.map(p=>p.media_path).filter((v):v is string=>Boolean(v)))];
      const signed=await Promise.all(paths.map(async path=>{
        const {data}=await client.storage.from(bucket).createSignedUrl(path,3600);
        return [path,data?.signedUrl||''] as const;
      }));
      if(!mounted.current)return;
      setPosts(records);setLikes(likesResult.data as Reaction[]||[]);
      setReposts(repostResult.data as Reaction[]||[]);
      setSaved(new Set((savedResult.data||[]).map(x=>x.post_id)));

      setFollowing(new Set((followResult.data||[]).map(x=>x.followed_id)));
      setHiddenCreators(new Set((hiddenResult.data||[]).map(x=>x.hidden_user_id)));
      if(owner){
        const {data:reportsData}=await client.from('zuzucord_social_reports')
          .select('id,post_id,reporter_id,reason,created_at')
          .is('reviewed_at',null).order('created_at',{ascending:false}).limit(100);
        if(mounted.current)setReports(reportsData||[]);
      }
      setAuthors(nameMap);setMediaUrls(Object.fromEntries(signed));
    }catch(e){if(mounted.current)setError(getErr(e));}
    finally{if(mounted.current)setLoading(false);}
  },[userId,owner]);
  useEffect(()=>{
    mounted.current=true;void load();
    const interval=window.setInterval(()=>{void load();},60000);
    return ()=>{mounted.current=false;window.clearInterval(interval);}
  },[load]);
  useEffect(()=>{
    if(!file){setPreview(null);return;}
    const url=URL.createObjectURL(file);setPreview(url);
    return ()=>URL.revokeObjectURL(url);
  },[file]);
  const name=(id:string)=>authors[id]?.display_name||authors[id]?.username||'ZuzuCord member';
  const handleFile=(next?:File)=>{
    if(!next){setFile(null);return;}
    if(!formats[next.type])return setError('Select a PNG, JPEG, WebP, GIF, MP4 or WebM file.');
    if(next.size>maxUpload)return setError('Media must be 25 MB or smaller.');
    setFile(next);setError('');
  };
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy)return;
    const body=content.trim();
    if(!body&&!file)return setError('Write a post or add a photo/video.');
    setBusy(true);setError('');
    let uploaded:string|null=null;
    try{
      if(file){
        uploaded=userId+'/'+crypto.randomUUID()+'.'+formats[file.type];
        const {error:uploadError}=await client.storage.from(bucket)
          .upload(uploaded,file,{contentType:file.type,cacheControl:'3600',upsert:false});
        if(uploadError)throw uploadError;
      }
      const {error:insertError}=await client.from('zuzucord_social_posts').insert({
        author_id:userId,kind,content:body,media_path:uploaded,
        media_type:file?(file.type.startsWith('video/')?'video':'image'):null
      });
      if(insertError)throw insertError;
      setContent('');setFile(null);setPreview(null);onMessage('Published to ZuzuCord Socials.');
      await load();
    }catch(e){
      if(uploaded)void client.storage.from(bucket).remove([uploaded]).catch(()=>{});
      setError(getErr(e));
    }finally{setBusy(false);}
  };
  const toggleLike=async(postId:string)=>{
    try{
      const liked=likes.some(x=>x.post_id===postId&&x.user_id===userId);
      const result=liked?await client.from('zuzucord_social_likes').delete()
        .eq('post_id',postId).eq('user_id',userId):
        await client.from('zuzucord_social_likes').insert({post_id:postId,user_id:userId});
      if(result.error)throw result.error;
      setLikes(old=>liked?old.filter(x=>!(x.post_id===postId&&x.user_id===userId)):
        [...old,{post_id:postId,user_id:userId}]);
    }catch(e){setError(getErr(e));}
  };
  const toggleRepost=async(postId:string)=>{
    try{
      const shared=reposts.some(x=>x.post_id===postId&&x.user_id===userId);
      const result=shared?await client.from('zuzucord_social_reposts')
        .delete().eq('post_id',postId).eq('user_id',userId):
        await client.from('zuzucord_social_reposts').insert({post_id:postId,user_id:userId});
      if(result.error)throw result.error;
      setReposts(old=>shared?old.filter(x=>!(x.post_id===postId&&x.user_id===userId)):
        [...old,{post_id:postId,user_id:userId}]);
      onMessage(shared?'Reshare removed.':'Reshared to your Socials activity.');
    }catch(error){setError(getErr(error));}
  };
  const viewCreator=async(id:string)=>{
    setSelectedCreator(id);
    setCreatorStatus('');setCreatorBio('');setCreatorPronouns('');setCreatorBanner('');
    try{
      const {data,error}=await client.from('zuzucord_profiles')
        .select('display_name,status_text,bio,pronouns,avatar_url,banner_path').eq('user_id',id).maybeSingle();
      if(error)throw error;
      setCreatorStatus(data?.status_text||'');setCreatorBio(data?.bio||'');
      setCreatorPronouns(data?.pronouns||'');
      if(data?.display_name)setAuthors(old=>({...old,[id]:{
        ...(old[id]||{username:'member'}),display_name:data.display_name
      }}));
      if(data?.banner_path){
        const {data:link}=await client.storage.from('zuzucord-profile-media')
          .createSignedUrl(data.banner_path,1800);
        if(link?.signedUrl)setCreatorBanner(link.signedUrl);
      }
    }catch(error){setError(getErr(error));}
  };
  const toggleSaved=async(postId:string)=>{
    try{
      const yes=saved.has(postId);
      const result=yes?await client.from('zuzucord_social_bookmarks').delete()
        .eq('post_id',postId).eq('user_id',userId):
        await client.from('zuzucord_social_bookmarks').insert({post_id:postId,user_id:userId});
      if(result.error)throw result.error;
      setSaved(old=>{const next=new Set(old);if(yes)next.delete(postId);else next.add(postId);return next;});
    }catch(e){setError(getErr(e));}
  };
  const toggleHidden=async(target:string)=>{
    if(target===userId)return;
    try{
      const exists=hiddenCreators.has(target);
      if(!exists&&!confirm('Hide this creator’s posts from your ZuzuCord feed? You can undo this in the Hidden tab.'))return;
      const result=exists?await client.from('zuzucord_social_hidden_creators').delete()
        .eq('user_id',userId).eq('hidden_user_id',target):
        await client.from('zuzucord_social_hidden_creators').insert({user_id:userId,hidden_user_id:target});
      if(result.error)throw result.error;
      setHiddenCreators(old=>{const n=new Set(old);if(exists)n.delete(target);else n.add(target);return n;});
      onMessage(exists?'Creator restored to your feed.':'Creator hidden from your feed.');
    }catch(e){setError(getErr(e));}
  };
  const resolveReport=async(reportId:string)=>{
    if(!owner)return;
    try{
      const {error:reviewError}=await client.from('zuzucord_social_reports')
        .update({reviewed_at:new Date().toISOString()}).eq('id',reportId);
      if(reviewError)throw reviewError;
      setReports(old=>old.filter(r=>r.id!==reportId));
      onMessage('Report marked reviewed.');
    }catch(e){setError(getErr(e));}
  };
  const reportPost=async(postId:string)=>{
    const reason=prompt('Why are you reporting this post? Please give a short explanation (8–500 characters).');
    if(reason===null)return;
    if(reason.trim().length<8||reason.length>500){setError('Please enter 8–500 characters explaining the issue.');return;}
    try{
      const result=await client.from('zuzucord_social_reports').insert({
        post_id:postId,reporter_id:userId,reason:reason.trim()
      });
      if(result.error)throw result.error;
      onMessage('Report submitted for Owner review.');
    }catch(e){setError(getErr(e));}
  };
  const toggleFollow=async(target:string)=>{
    if(target===userId)return;
    try{
      const yes=following.has(target);
      const result=yes?await client.from('zuzucord_social_follows').delete()
        .eq('follower_id',userId).eq('followed_id',target):
        await client.from('zuzucord_social_follows').insert({follower_id:userId,followed_id:target});
      if(result.error)throw result.error;
      setFollowing(old=>{const next=new Set(old);if(yes)next.delete(target);else next.add(target);return next;});
    }catch(e){setError(getErr(e));}
  };
  const openComments=async(postId:string)=>{
    if(expanded.has(postId)){
      setExpanded(old=>{const n=new Set(old);n.delete(postId);return n;});return;
    }
    try{
      const {data,error:loadError}=await client.from('zuzucord_social_comments')
        .select('id,post_id,author_id,content,created_at').eq('post_id',postId)
        .order('created_at',{ascending:true}).limit(100);
      if(loadError)throw loadError;
      const list=(data||[]) as Comment[];
      const users=[...new Set(list.map(c=>c.author_id).filter(u=>!authors[u]))];
      if(users.length){
        const {data:named}=await client.from('zuzucord_accounts').select('user_id,username').in('user_id',users);
        setAuthors(old=>({...old,...Object.fromEntries((named||[]).map(a=>[a.user_id,{username:a.username}]))}));
      }
      setComments(old=>({...old,[postId]:list}));
      setExpanded(old=>new Set(old).add(postId));
    }catch(e){setError(getErr(e));}
  };
  const sendComment=async(event:React.FormEvent,postId:string)=>{
    event.preventDefault();const body=commentDrafts[postId]?.trim();
    if(!body||busy)return;
    setBusy(true);
    try{
      const {error:postError}=await client.from('zuzucord_social_comments')
        .insert({post_id:postId,author_id:userId,content:body});
      if(postError)throw postError;
      setCommentDrafts(old=>({...old,[postId]:''}));
      const {data,error:loadError}=await client.from('zuzucord_social_comments')
        .select('id,post_id,author_id,content,created_at').eq('post_id',postId)
        .order('created_at',{ascending:true}).limit(100);
      if(loadError)throw loadError;
      setComments(old=>({...old,[postId]:(data||[]) as Comment[]}));
    }catch(e){setError(getErr(e));}
    finally{setBusy(false);}
  };
  const deletePost=async(post:Post)=>{
    if(post.author_id!==userId&&!owner)return;
    if(!confirm('Delete this '+post.kind+' and all its comments?'))return;
    try{
      const {error:deleteError}=await client.from('zuzucord_social_posts').delete().eq('id',post.id);
      if(deleteError)throw deleteError;
      if(post.media_path&&post.author_id===userId)void client.storage.from(bucket).remove([post.media_path]);
      setPosts(old=>old.filter(x=>x.id!==post.id));
      onMessage('Social post deleted.');
    }catch(e){setError(getErr(e));}
  };
  const visible=useMemo(()=>{
    let list=posts.filter(p=>
      tab==='hidden'?hiddenCreators.has(p.author_id):hiddenCreators.has(p.author_id)?false:
      tab==='moments'?p.kind==='moment':
      tab==='following'?following.has(p.author_id)||p.author_id===userId:
      tab==='saved'?saved.has(p.id):
      tab==='reshares'?reposts.some(r=>r.post_id===p.id&&r.user_id===userId):
      tab==='discover'?true:true);
    if(tab==='discover')list=list.filter(p=>p.author_id!==userId);
    if(search.trim()){
      const query=search.trim().toLowerCase();
      list=list.filter(p=>p.content.toLowerCase().includes(query)||
        (authors[p.author_id]?.username||'').toLowerCase().includes(query));
    }
    if(sort==='popular')list=[...list].sort((a,b)=>
      likes.filter(x=>x.post_id===b.id).length-likes.filter(x=>x.post_id===a.id).length);
    return list;
  },[posts,tab,following,saved,hiddenCreators,reposts,userId,search,authors,sort,likes]);
  const creators=[...new Set(posts.map(p=>p.author_id).filter(id=>id!==userId))].slice(0,10);
  return <div className="socials-shell">
    <div className="socials-page-header">
      <div><div className="socials-overline"><Sparkles size={15}/> ZUZUCORD SOCIALS</div>
        <h2>What's happening</h2><p>{description}</p></div>
      <button className="socials-refresh" onClick={()=>void load()} disabled={loading}>
        <RefreshCw size={16}/>{loading?'Refreshing':'Refresh feed'}</button>
    </div>
    <div className="socials-tabs" role="tablist" aria-label="Social feeds">
      {([['feed','For you',Compass],['moments','Moments',Film],['following','Following',Users],
        ['saved','Saved',Bookmark],['reshares','Reshares',Repeat2],
        ['discover','Discover',UserPlus],['hidden','Hidden',X],
        ...(owner?[['reports','Reports',MoreHorizontal] as const]:[])] as const).map(([id,label,Icon])=>
        <button key={id} role="tab" aria-selected={tab===id}
          className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={16}/>{label}</button>)}
    </div>
    <div className="socials-columns"><main className="socials-timeline">
      <form className="socials-composer" onSubmit={e=>void submit(e)}>
        <div className="socials-composer-header"><button type="button"
          className="socials-avatar socials-avatar-button" onClick={onAccountSettings}
          aria-label="Open my account settings">YOU</button>
          <div><strong>Share with ZuzuCord</strong><small>Visible to signed-in members</small>
            <button type="button" className="socials-my-account-link" onClick={onAccountSettings}>My account & settings</button></div></div>
        <textarea maxLength={kind==='moment'?500:2000} rows={3} value={content}
          placeholder={kind==='moment'?'Caption your Moment…':"What's new?"}
          onChange={e=>setContent(e.target.value)}/>
        {file&&preview&&<div className="socials-composer-preview">
          {file.type.startsWith('video/')?<video src={preview} controls playsInline/>:
            <img src={preview} alt="Selected attachment preview"/>}
          <button type="button" onClick={()=>{setFile(null);if(fileRef.current)fileRef.current.value='';}} aria-label="Remove attachment"><X size={18}/></button>
        </div>}
        <div className="socials-composer-footer"><div className="socials-creation-tools">
          <button type="button" className={kind==='post'?'selected':''}
            onClick={()=>setKind('post')}><MessageCircle size={16}/> Post</button>
          <button type="button" className={kind==='moment'?'selected':''}
            onClick={()=>setKind('moment')}><Film size={16}/> Moment</button>
          <button type="button" onClick={()=>fileRef.current?.click()}
            title="Attach image or video"><ImageIcon size={17}/> Media</button>
          <input ref={fileRef} hidden type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            onChange={e=>handleFile(e.target.files?.[0])}/>
        </div><button className="button button-primary" type="submit" disabled={busy||(!content.trim()&&!file)}>
          <Send size={15}/>{busy?'Publishing…':'Publish'}</button></div>
        <p className="socials-composer-hint">Photos and videos up to 25 MB. Avoid sharing private information.</p>
      </form>
      <div className="socials-searchbar"><Compass size={17}/>
        <input value={search} placeholder="Search posts and usernames" aria-label="Search posts"
          onChange={e=>setSearch(e.target.value)}/>
        <select value={sort} aria-label="Sort posts" onChange={e=>setSort(e.target.value as 'recent'|'popular')}>
          <option value="recent">Newest</option><option value="popular">Most liked</option></select>
      </div>
      {error&&<div className="socials-error" role="alert">{error}
        <button onClick={()=>setError('')} aria-label="Dismiss error"><X size={14}/></button></div>}
      {tab==='reports' && owner && <section className="socials-reports">
        <h3>Moderation reports <span>{reports.length} pending</span></h3>
        {reports.length===0?<p>No unresolved reports.</p>:
          reports.map(report=><article key={report.id}>
            <div><strong>Post {report.post_id.slice(0,8)}</strong><span>{ago(report.created_at)}</span></div>
            <p>{report.reason}</p>
            <div className="socials-report-actions">
              <button onClick={()=>void resolveReport(report.id)}><Check size={15}/> Mark reviewed</button>
              <button onClick={()=>{setTab('feed');setSearch('');}}>
                <Compass size={15}/> Return to feed</button>
              {posts.find(p=>p.id===report.post_id) &&
                <button onClick={()=>void deletePost(posts.find(p=>p.id===report.post_id)!)} className="danger">
                  <Trash2 size={15}/> Delete reported post</button>}
            </div>
          </article>)}
      </section>}
      {tab!=='reports' && (visible.length===0?<div className="socials-empty"><Compass size={34}/>
        <h3>{loading?'Loading Socials…':tab==='saved'?'Nothing saved yet.':'Nothing here yet.'}</h3>
        <p>{loading?'Loading recent posts and Moments from Supabase.':
          tab==='following'?'Follow other creators to see their posts here.':
          tab==='saved'?'Bookmark posts to keep them here.':
          tab==='hidden'?'Your hidden creators will appear here.':
          'Be the first to publish something for the community.'}</p></div>:
      visible.map(post=>{
        const liked=likes.some(l=>l.post_id===post.id&&l.user_id===userId);
        const count=likes.filter(l=>l.post_id===post.id).length;
        const followingAuthor=following.has(post.author_id);
        const own=post.author_id===userId;
        const commentList=comments[post.id]||[];
        return <article className="socials-post" key={post.id}>
          <div className="socials-post-top"><button type="button"
            className="socials-avatar socials-avatar-button"
            aria-label={'View '+name(post.author_id)+' profile'}
            onClick={()=>void viewCreator(post.author_id)}>
            {authors[post.author_id]?.avatarSrc?
              <img src={authors[post.author_id].avatarSrc} alt="" className="socials-avatar-img"/>:
              (name(post.author_id).slice(0,2)||'ZU').toUpperCase()}</button>
            <div className="socials-post-author"><button type="button" className="socials-author-link"
              onClick={()=>void viewCreator(post.author_id)}>{name(post.author_id)}</button>
              <span>@{authors[post.author_id]?.username||'member'} · {ago(post.created_at)}
                {post.kind==='moment'&&<b> MOMENT</b>}</span></div>
            {!own&&<button className="socials-follow" onClick={()=>void toggleFollow(post.author_id)}>
              {followingAuthor?<Check size={15}/>:<UserPlus size={15}/>}
              {followingAuthor?'Following':'Follow'}</button>}
            {!own&&<button className="socials-post-delete" onClick={()=>void toggleHidden(post.author_id)}
              title={hiddenCreators.has(post.author_id)?'Show creator again':'Hide this creator'}
              aria-label={hiddenCreators.has(post.author_id)?'Show creator':'Hide creator'}><X size={16}/></button>}
            {(own||owner)&&<button className="socials-post-delete" onClick={()=>void deletePost(post)}
              title="Delete post" aria-label="Delete post"><Trash2 size={17}/></button>}
          </div>
          {post.content&&<p className="socials-post-content">{post.content}</p>}
          {post.media_path&&mediaUrls[post.media_path]&&
            <div className="socials-media">{post.media_type==='video'?
              <video controls playsInline preload="metadata" src={mediaUrls[post.media_path]}/>:
              <img src={mediaUrls[post.media_path]} loading="lazy" alt="User-posted Socials media"/>}
            </div>}
          <div className="socials-post-actions">
            <button className={liked?'liked':''} onClick={()=>void toggleLike(post.id)}
              aria-label={liked?'Unlike post':'Like post'}><Heart size={17} fill={liked?'currentColor':'none'}/>{count}</button>
            <button onClick={()=>void openComments(post.id)}><MessageCircle size={17}/>
              {expanded.has(post.id)?'Hide replies':'Comments'}</button>
            <button className={reposts.some(r=>r.post_id===post.id&&r.user_id===userId)?'reshared':''}
              onClick={()=>void toggleRepost(post.id)}
              aria-label={reposts.some(r=>r.post_id===post.id&&r.user_id===userId)?'Remove reshare':'Reshare post'}>
              <Repeat2 size={17}/> {reposts.filter(r=>r.post_id===post.id).length}
            </button>
            <button className={saved.has(post.id)?'saved':''} onClick={()=>void toggleSaved(post.id)}
              aria-label={saved.has(post.id)?'Remove bookmark':'Bookmark post'}>
              <Bookmark size={17} fill={saved.has(post.id)?'currentColor':'none'}/> {saved.has(post.id)?'Saved':'Save'}</button>
            {!own&&<button onClick={()=>void reportPost(post.id)} title="Report a post to ZuzuCord moderators">
              <MoreHorizontal size={16}/> Report</button>}
            <button onClick={()=>{
              void navigator.clipboard.writeText(name(post.author_id)+' on ZuzuCord: '+post.content)
                .then(()=>onMessage('Post text copied to clipboard.'))
                .catch(()=>onMessage('Clipboard unavailable.'));
            }}><Copy size={16}/> Copy</button>
          </div>
          {expanded.has(post.id)&&<div className="socials-comments">
            {commentList.length===0&&<p>No comments yet. Start the conversation.</p>}
            {commentList.map(comment=><div className="socials-comment" key={comment.id}>
              <span className="socials-avatar small">{(name(comment.author_id).slice(0,2)||'ZU').toUpperCase()}</span>
              <div><strong>{name(comment.author_id)}</strong><small>{ago(comment.created_at)}</small>
                <p>{comment.content}</p></div></div>)}
            <form onSubmit={e=>void sendComment(e,post.id)}>
              <input maxLength={1000} value={commentDrafts[post.id]||''}
                onChange={e=>setCommentDrafts(old=>({...old,[post.id]:e.target.value}))}
                placeholder="Write a thoughtful comment…" aria-label="Write a comment"/>
              <button aria-label="Post comment" disabled={busy||!commentDrafts[post.id]?.trim()}>
                <Send size={16}/></button>
            </form>
          </div>}
        </article>;
      }))}
      {selectedCreator && <div className="socials-profile-backdrop" onClick={()=>setSelectedCreator(null)}>
        <section className="socials-profile-panel" role="dialog" aria-modal="true"
          aria-label={name(selectedCreator)+' social profile'} onClick={event=>event.stopPropagation()}>
          <button className="socials-profile-close" aria-label="Close profile"
            onClick={()=>setSelectedCreator(null)}><X size={19}/></button>
          <div className="socials-profile-banner" style={creatorBanner?{backgroundImage:'url('+JSON.stringify(creatorBanner)+')'}:undefined}/>
          <div className="socials-profile-avatar">{authors[selectedCreator]?.avatarSrc?
              <img src={authors[selectedCreator].avatarSrc} alt="" className="socials-avatar-img"/>:
              name(selectedCreator).slice(0,2).toUpperCase()}</div>
          <h3>{name(selectedCreator)}</h3>
          <p className="socials-profile-handle">@{authors[selectedCreator]?.username||'member'}</p>
          <p className="socials-profile-status">{creatorStatus||'ZuzuCord community member'}</p>
          {creatorPronouns&&<p className="socials-profile-status">{creatorPronouns}</p>}
          {creatorBio&&<p className="socials-profile-bio">{creatorBio}</p>}
          <div className="socials-profile-counts">
            <span><strong>{posts.filter(p=>p.author_id===selectedCreator).length}</strong> Recent posts</span>
            <span><strong>{new Set(reposts.filter(r=>posts.some(p=>p.author_id===selectedCreator&&p.id===r.post_id)).map(r=>r.user_id)).size}</strong> Resharers</span>
          </div>
          {selectedCreator===userId?
            <button className="button button-primary" onClick={()=>{setSelectedCreator(null);onAccountSettings();}}>
              <Users size={16}/> My account settings</button>:
            <button className="button button-primary" onClick={()=>void toggleFollow(selectedCreator)}>
              <UserPlus size={16}/>{following.has(selectedCreator)?'Unfollow creator':'Follow creator'}</button>}
          <button className="button button-subtle"
            onClick={()=>{setTab('feed');setSearch(authors[selectedCreator]?.username||'');setSelectedCreator(null);}}>
            View posts</button>
        </section>
      </div>}
      {visible.length>=100&&<p className="socials-limit">Showing the latest 100 posts. More feed pagination is planned.</p>}
    </main>
    <aside className="socials-discover">
      <section><div className="socials-panel-heading"><Sparkles size={17}/> Your Socials</div>
        <div className="socials-summary">
          <div><strong>{posts.filter(x=>x.author_id===userId).length}</strong><small>Posts shown</small></div>
          <div><strong>{following.size}</strong><small>Following</small></div>
          <div><strong>{saved.size}</strong><small>Saved</small></div>
        </div></section>
      <section><div className="socials-panel-heading"><Users size={17}/> Creators</div>
        {creators.length===0?<p className="socials-panel-note">Creators will appear here when they publish.</p>:
          creators.map(id=><div className="socials-creator" key={id}>
            <span className="socials-avatar small">{name(id).slice(0,2).toUpperCase()}</span>
            <div><strong>{name(id)}</strong><small>@{authors[id]?.username||'member'}</small></div>
            <button title={following.has(id)?'Unfollow creator':'Follow creator'}
              onClick={()=>void toggleFollow(id)}>{following.has(id)?<Check size={15}/>:<UserPlus size={15}/>}</button></div>)}
      </section>
      <section className="socials-guidelines"><div className="socials-panel-heading"><Camera size={17}/> Moments</div>
        <p>Share images, short videos, and updates with your ZuzuCord community. Keep your content respectful and avoid sharing sensitive details.</p>
      </section>
    </aside></div>
  </div>;
}
