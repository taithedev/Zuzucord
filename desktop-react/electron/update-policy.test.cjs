'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRelease, newerVersion } = require('./update-policy.cjs');
function release(tag, options={}) {
  const version = tag.startsWith('v') ? tag.slice(1) : tag;
  return { tag_name:tag, draft:false, prerelease:false,
    assets:[
      {name:'ZuzuCord-React-'+version+'-x64.exe',
        browser_download_url:'https://github.com/taithedev/Zuzucord/releases/download/'+tag+'/ZuzuCord-React-'+version+'-x64.exe'},
      {name:'latest.yml'} ],
    ...options };
}
test('accepts newer versioned stable releases with installer and checksum metadata',()=>{
  assert.deepEqual(validateRelease(release('v0.11.68'),'0.11.67'),
    {version:'0.11.68',tag:'v0.11.68'});
  assert.equal(newerVersion('1.0.0','0.99.99'),true);
});
test('rejects manual installer tags, unversioned, drafts, prereleases and old builds',()=>{
  for(const tag of ['installer','v0.11.0-installer','V2.0.0','v2','nope','v2.1.2-beta']){
    assert.equal(validateRelease(release(tag),'0.10.0'),null,tag);
  }
  assert.equal(validateRelease(release('v0.11.68',{draft:true}),'0.11.67'),null);
  assert.equal(validateRelease(release('v0.11.68',{prerelease:true}),'0.11.67'),null);
  assert.equal(validateRelease(release('v0.9.0'),'0.10.0'),null);
  assert.equal(validateRelease(release('v0.10.0'),'0.10.0'),null);
});
test('rejects unverified or unexpected release assets',()=>{
  const withoutManifest = release('v0.11.68');
  withoutManifest.assets.pop();
  assert.equal(validateRelease(withoutManifest,'0.11.67'),null);
  const wrongRepo=release('v0.11.68');
  wrongRepo.assets[0].browser_download_url='https://example.com/setup.exe';
  assert.equal(validateRelease(wrongRepo,'0.11.67'),null);
  const wrongVersion=release('v0.11.68');
  wrongVersion.assets[0].name='ZuzuCord-React-0.11.67-x64.exe';
  assert.equal(validateRelease(wrongVersion,'0.11.67'),null);
});
