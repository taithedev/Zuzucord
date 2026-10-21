// Pure parser for the exact ZuzuCord GitHub release/update policy.
// Ignore any release not beginning with lowercase "v" + an integer.
const validTag = /^v\d+(?:\.\d+){0,2}(?:[-.][a-zA-Z0-9.-]+)?$/;
function parts(tag) {
  if (typeof tag !== 'string' || !validTag.test(tag)) return null;
  const match = /^v(\d+)(?:\.(\d+))?(?:\.(\d+))?(.*)$/.exec(tag);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]||0), Number(match[3]||0),
    Number((/\.(\d+)$/.exec(match[4]||'')||[])[1]||0)];
}
function isNewer(candidate, installed) {
  const a=parts(candidate), b=parts(installed);
  if (!a || !b) return false;
  for(let i=0;i<a.length;i++){
    if(a[i]>b[i])return true;
    if(a[i]<b[i])return false;
  }
  return false;
}
function selectUpdate(releases, installed) {
  if (!Array.isArray(releases)) return null;
  const options=[];
  for(const release of releases){
    if (release?.draft || !isNewer(release?.tag_name, installed)) continue;
    const asset=(release.assets||[]).find(a =>
      /^ZuzuCord-React-\d+\.\d+\.\d+-x64\.exe$/i.test(a.name||'') &&
      typeof a.browser_download_url==='string' &&
      a.browser_download_url.startsWith(
        'https://github.com/taithedev/Zuzucord/releases/download/'));
    if(!asset)continue;
    options.push({
      tag:release.tag_name, filename:asset.name, downloadUrl:asset.browser_download_url,
      sha256: typeof asset.digest==='string' && /^sha256:[a-f0-9]{64}$/i.test(asset.digest)
        ? asset.digest.slice(7):null,
      publishedAt:release.published_at||null, prerelease:!!release.prerelease,
      notes:(release.body||'').slice(0,1200)
    });
  }
  options.sort((a,b) => isNewer(a.tag,b.tag) ? -1 : isNewer(b.tag,a.tag) ? 1 : 0);
  return options[0]||null;
}
module.exports={validTag,parts,isNewer,selectUpdate};
