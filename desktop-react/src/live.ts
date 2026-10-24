import { client } from './api';
// Subscribe before fetching; refresh after every successful join to cover reconnect gaps.
export function watchTables(name:string,tables:string[],refresh:()=>void,onState?:(live:boolean)=>void) {
  let active=true;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const schedule=()=>{ if(!active)return; clearTimeout(timer); timer=setTimeout(()=>{if(active)refresh();},80); };
  const channel=client.channel(name);
  for(const table of tables)channel.on('postgres_changes',{event:'*',schema:'public',table},schedule);
  channel.subscribe(state=>{if(!active)return;onState?.(state==='SUBSCRIBED');if(state==='SUBSCRIBED')schedule();});
  const fallback=setInterval(schedule,30000);
  const focus=()=>schedule();
  window.addEventListener('online',focus);window.addEventListener('focus',focus);
  schedule();
  return ()=>{active=false;clearTimeout(timer);clearInterval(fallback);window.removeEventListener('online',focus);
    window.removeEventListener('focus',focus);void client.removeChannel(channel);};
}
