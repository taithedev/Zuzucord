import { useEffect, useState } from 'react';
import { Check, Gem, History, LockKeyhole, Palette, Sparkles, WandSparkles } from 'lucide-react';
import { appApi } from './api';

export function CrystalCenter({
  userId,serverId,serverName,isOwner,level,crystals,legacyCredits,
  onBoost,onMessage,onSaved
}:{
  userId:string;serverId:string|null;serverName:string;isOwner:boolean;
  level:number;crystals:number;legacyCredits:number;
  onBoost:()=>Promise<void>;onMessage:(message:string)=>void;onSaved:()=>Promise<void>
}) {
  const [history,setHistory]=useState<{id:string;amount:number;reason:string;created_at:string}[]>([]);
  const [accent,setAccent]=useState('#a978ff');
  const [gradient,setGradient]=useState('#0c0715');
  const [busy,setBusy]=useState(false);
  const balance=crystals+legacyCredits*100;
  useEffect(()=>{
    let active=true;
    appApi.crystalHistory(userId).then(data=>{if(active)setHistory(data);})
      .catch(error=>onMessage(error instanceof Error?error.message:'Unable to load Crystal history.'));
    return ()=>{active=false;};
  },[userId,level,crystals,legacyCredits]);
  useEffect(()=>{
    if(!serverId)return;
    let active=true;
    appApi.serverBrand(serverId).then(data=>{if(active){setAccent(data.accent_color);setGradient(data.gradient_color);}})
      .catch(()=>{});
    return ()=>{active=false;};
  },[serverId]);
  const saveBrand=async()=>{
    if(!serverId || !isOwner || level<1)return;
    setBusy(true);
    try{
      await appApi.customizeServer(serverId,accent,gradient);
      await onSaved();
      onMessage('Server colors saved. Your server banner has been refreshed for the current session.');
    }catch(error){onMessage(error instanceof Error?error.message:'Could not save server style.');}
    finally{setBusy(false);}
  };
  return <div className="crystals-center">
    <div className="crystals-hero">
      <div className="crystals-symbol"><Gem size={30}/></div>
      <div><span className="crystals-eyebrow">YOUR BALANCE</span>
        <strong>{balance.toLocaleString()} <span>Crystals</span></strong>
        <small>Virtual community rewards · no cash value · not for purchase</small></div>
    </div>
    {legacyCredits>0 && <p className="crystal-legacy">
      Your {legacyCredits} original ServerBoostCredit{legacyCredits===1?'':'s'} remain usable,
      equal to {(legacyCredits*100).toLocaleString()} Crystals in the displayed balance.
    </p>}
    <div className="crystal-cost-row">
      <span><Gem size={16}/> 100 Crystals per boost</span>
      <span>{serverId ? (serverName || 'Selected server') : 'Select a server to boost'}</span>
    </div>
    <div className="crystal-levels">
      {[1,2,3].map(tier=><div key={tier} className={'crystal-tier '+(level>=tier?'unlocked':'')}>
        <span className="tier-number">{level>=tier?<Check size={16}/>:tier}</span>
        <strong>Level {tier}</strong>
        <small>{tier===1?'40 channels + custom accent':
          tier===2?'50 channels + gradient banner':'60 channels + boosted server badge'}</small>
        <span className="tier-state">{level>=tier?'Unlocked':'100 Crystals'}</span>
      </div>)}
    </div>
    <button type="button" className="button button-primary full"
      disabled={!serverId || level>=3 || balance<100 || busy}
      onClick={()=>{setBusy(true);void onBoost().finally(()=>setBusy(false));}}>
      <Sparkles size={17}/>{level>=3?'Server fully boosted':!serverId?'Choose a server':'Boost '+(serverName||'server')+' · 100 Crystals'}
    </button>
    {isOwner && level>=1 && serverId && <section className="crystal-customize">
      <div className="crystals-section-title"><Palette size={17}/> Boosted server appearance</div>
      <p className="tiny muted">Customize your community. Level 1 unlocks accents; Level 2 unlocks gradients.</p>
      <div className="crystal-color-grid">
        <label>Accent color<input type="color" value={accent} onChange={e=>setAccent(e.target.value)}/></label>
        <label>Banner gradient<input type="color" disabled={level<2} value={gradient} onChange={e=>setGradient(e.target.value)}/></label>
      </div>
      <button className="button button-subtle" disabled={busy} onClick={()=>void saveBrand()}>
        <WandSparkles size={16}/> Save server appearance
      </button>
    </section>}
    <section className="crystal-history">
      <div className="crystals-section-title"><History size={17}/> Crystal activity</div>
      {history.length===0?<p className="muted tiny">No Crystal transactions yet. Developers can grant Crystals directly to your account.</p>:
        history.slice(0,12).map(item=><div className="crystal-transaction" key={item.id}>
          <span>{item.reason==='server_boost'?'Server boost':'Developer grant'}
            <small>{new Date(item.created_at).toLocaleDateString()}</small></span>
          <strong className={item.amount<0?'negative':'positive'}>
            {item.amount>0?'+':''}{item.amount} ◆</strong>
        </div>)}
    </section>
    <p className="crystal-disclaimer"><LockKeyhole size={14}/> Balances and redemptions are verified on the server. Crystals cannot be purchased, transferred, exchanged or withdrawn.</p>
  </div>;
}
