export type ClientPreferences = {
  highContrast: boolean;
  fontScale: number;
  desktopFriendAlerts: boolean;
  showActivityPanel: boolean;
  messageSpacing: 'comfortable' | 'compact';
};
const KEY='zuzucord_client_preferences_v2';
export const DEFAULT_CLIENT_PREFERENCES:ClientPreferences = {
  highContrast:false, fontScale:100, desktopFriendAlerts:false,
  showActivityPanel:true, messageSpacing:'comfortable'
};
export function readClientPreferences():ClientPreferences {
  try {
    const stored=JSON.parse(localStorage.getItem(KEY)||'{}') as Partial<ClientPreferences>;
    return {
      highContrast:stored.highContrast===true,
      fontScale:typeof stored.fontScale==='number' && Number.isFinite(stored.fontScale)
        ? Math.max(85,Math.min(125,Math.round(stored.fontScale/5)*5)):100,
      desktopFriendAlerts:stored.desktopFriendAlerts===true,
      showActivityPanel:stored.showActivityPanel!==false,
      messageSpacing:stored.messageSpacing==='compact'?'compact':'comfortable'
    };
  }catch{return DEFAULT_CLIENT_PREFERENCES;}
}
export function saveClientPreferences(value:ClientPreferences) {
  try{ localStorage.setItem(KEY,JSON.stringify(value)); }catch {/* Private browsing */ }
}
