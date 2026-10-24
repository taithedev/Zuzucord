import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  let sequence=0;const timers=new Map(),intervals=new Map(),listeners=new Map();
  const events=[],states=[],removed=[];
  let subscription;
  const channel={on(type,filter,cb){events.push({type,filter,cb});return this;},subscribe(cb){subscription=cb;return this;}};
  const exports={};
  const context={exports,require:()=>({client:{channel:()=>channel,removeChannel:c=>removed.push(c)}}),
    setTimeout:cb=>{const id=++sequence;timers.set(id,cb);return id;},clearTimeout:id=>timers.delete(id),
    setInterval:cb=>{const id=++sequence;intervals.set(id,cb);return id;},clearInterval:id=>intervals.delete(id),
    window:{addEventListener:(name,cb)=>listeners.set(name,cb),removeEventListener:name=>listeners.delete(name)}};
  const source=readFileSync(new URL('../src/live.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
  let refreshes=0;
  const stop=exports.watchTables('test',['zuzucord_server_messages','zuzucord_direct_messages'],()=>refreshes++,v=>states.push(v));
  return {events,states,removed,timers,intervals,listeners,stop,state:s=>subscription(s),
    flush(){const callbacks=[...timers.values()];timers.clear();callbacks.forEach(cb=>cb());},get refreshes(){return refreshes;}};
}
test('fetches initially, coalesces event bursts, and recovers missed changes after reconnect',()=>{
 const h=harness();h.flush();assert.equal(h.refreshes,1);
 for(let i=0;i<20;i++)h.events[i%2].cb();h.flush();assert.equal(h.refreshes,2);
 h.state('CHANNEL_ERROR');h.state('SUBSCRIBED');h.flush();assert.equal(h.refreshes,3);
 assert.deepEqual(h.states,[false,true]);h.listeners.get('online')();h.flush();assert.equal(h.refreshes,4);
 h.stop();
});
test('unmount cancels queued refreshes, fallback timers and listeners; late callbacks are inert',()=>{
 const h=harness();h.events[0].cb();h.stop();h.flush();h.events[0].cb();h.state('SUBSCRIBED');h.flush();
 assert.equal(h.refreshes,0);assert.equal(h.removed.length,1);
 assert.equal(h.timers.size,0);assert.equal(h.intervals.size,0);assert.equal(h.listeners.size,0);
});
