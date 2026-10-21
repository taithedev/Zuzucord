const test=require('node:test');const assert=require('node:assert/strict');
const {selectUpdate,isNewer}=require('./versions.cjs');
test('only lowercase v-prefixed semantic tags qualify',()=>{
 assert.equal(isNewer('v1','v0.8.0'),true);
 assert.equal(isNewer('v2.1.0','v1.9.9'),true);
 assert.equal(isNewer('1.8.0','v0.8.0'),false);
 assert.equal(isNewer('V2','v1'),false);
 assert.equal(isNewer('v0.8.0-react.58','v0.8.0-react.57'),true);
 assert.equal(isNewer('v0.7.9-react.999','v0.8.0-react.57'),false);
});
test('rejects drafts, unsigned source bundles and arbitrary exe names',()=>{
 const release=(tag,name)=>({tag_name:tag,assets:[{name,browser_download_url:'https://github.com/taithedev/Zuzucord/releases/download/'+tag+'/'+name}]});
 assert.equal(selectUpdate([release('not-v2','ZuzuCord-React-2.0.0-x64.exe')],'v0.8.0'),null);
 assert.equal(selectUpdate([release('v2','notepad.exe')],'v0.8.0'),null);
 assert.equal(selectUpdate([{...release('v2','ZuzuCord-React-2.0.0-x64.exe'),draft:true}],'v0.8.0'),null);
 assert.equal(selectUpdate([release('v2.0.0','ZuzuCord-React-2.0.0-x64.exe')],'v0.8.0').tag,'v2.0.0');
});
