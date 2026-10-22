'use strict';
// Validate the only GitHub release shape that can receive automatic updates.
// This is intentionally testable without starting Electron.
const releaseTag = /^v\d+\.\d+\.\d+$/;
const installerName = /^ZuzuCord-React-(\d+\.\d+\.\d+)-x64\.exe$/;
function versionParts(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null;
  return version.split('.').map(Number);
}
function newerVersion(next, current) {
  const a = versionParts(next), b = versionParts(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
function validateRelease(release, currentVersion) {
  if (!release || release.draft || release.prerelease ||
      !releaseTag.test(release.tag_name || '')) return null;
  const version = release.tag_name.slice(1);
  if (!newerVersion(version, currentVersion)) return null;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const installer = assets.find(asset => {
    const match = installerName.exec(asset.name || '');
    return match && match[1] === version &&
      (asset.browser_download_url || '').startsWith(
        'https://github.com/taithedev/Zuzucord/releases/download/' + release.tag_name + '/');
  });
  if (!installer || !assets.some(asset => asset.name === 'latest.yml')) return null;
  return { version, tag: release.tag_name };
}
module.exports = { validateRelease, newerVersion };
