const { net, shell, app } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { isNewer, selectUpdate } = require('./versions.cjs');
const endpoint = 'https://api.github.com/repos/taithedev/Zuzucord/releases?per_page=60';
function installedTag() {
  try { return require('./release.json').tag || ('v' + app.getVersion()); }
  catch { return 'v' + app.getVersion(); }
}
async function lookupUpdate() {
  if (!app.isPackaged) return null;
  const response = await net.fetch(endpoint, {
    headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'ZuzuCord-Updater' }
  });
  if (!response.ok) throw Error('Could not check GitHub releases (HTTP ' + response.status + ')');
  const releases = await response.json();
  if (!Array.isArray(releases)) throw Error('Invalid GitHub release response');
  return selectUpdate(releases, installedTag());
}
function knownAsset(url, release) {
  return typeof url === 'string' && typeof release?.downloadUrl === 'string' &&
    url === release.downloadUrl &&
    url.startsWith('https://github.com/taithedev/Zuzucord/releases/download/');
}
async function downloadUpdate(release) {
  if (!release || !knownAsset(release.downloadUrl, release)) throw Error('Invalid release URL');
  // Recheck metadata from GitHub immediately before downloading, rather than
  // trusting renderer-supplied URLs, tags, filenames, or hashes.
  const latest = await lookupUpdate();
  if (!latest || latest.tag !== release.tag || latest.downloadUrl !== release.downloadUrl)
    throw Error('Release details changed. Recheck for updates.');
  const response = await net.fetch(latest.downloadUrl, {
    headers: { 'User-Agent': 'ZuzuCord-Updater' }
  });
  if (!response.ok) throw Error('GitHub download failed (HTTP ' + response.status + ')');
  const sizeLimit = 300 * 1024 * 1024;
  const declared = Number(response.headers.get('content-length') || '0');
  if (declared > sizeLimit) throw Error('Download exceeds the allowed size limit.');
  const array = await response.arrayBuffer();
  if (array.byteLength > sizeLimit || array.byteLength < 1000000)
    throw Error('Invalid installer size.');
  const data = Buffer.from(array);
  const digest = crypto.createHash('sha256').update(data).digest('hex');
  if (latest.sha256 && digest.toLowerCase() !== latest.sha256.toLowerCase())
    throw Error('Installer SHA-256 mismatch. The file was not saved.');
  const target = path.join(app.getPath('downloads'), latest.filename);
  const partial = target + '.download';
  fs.writeFileSync(partial, data);
  fs.renameSync(partial, target);
  shell.showItemInFolder(target);
  return { name: latest.filename, path: target, sha256: digest,
    verified: Boolean(latest.sha256),
    note: latest.sha256
      ? 'GitHub release digest verified. Open the installer when ready.'
      : 'Downloaded from the official GitHub release. No release checksum was published, so review before running.' };
}
module.exports = { lookupUpdate, downloadUpdate, installedTag };
