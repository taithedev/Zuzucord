export type ClientPreferences = {
  layout: 'discord' | 'studio';
  avatarShape: 'circle' | 'rounded';
  activityWidth: number;
  rowHeight: number;
  saturation: number;
  highContrast: boolean;
  fontScale: number;
  desktopFriendAlerts: boolean;
  showActivityPanel: boolean;
  messageSpacing: 'comfortable' | 'compact';
  messageStyle: 'classic' | 'cards';
  sidebarWidth: number;
  cornerRadius: number;
  serverIconScale: number;
  glowIntensity: number;
  backgroundPattern: 'none' | 'grid' | 'dots';
};
const KEY='zuzucord_client_preferences_v2';
export const DEFAULT_CLIENT_PREFERENCES:ClientPreferences = {
  layout:'discord', avatarShape:'circle', activityWidth:288, rowHeight:62, saturation:100,
  highContrast:false, fontScale:100, desktopFriendAlerts:false,
  showActivityPanel:true, messageSpacing:'comfortable',
  messageStyle:'classic', sidebarWidth:265, cornerRadius:12,
  serverIconScale:100, glowIntensity:70, backgroundPattern:'none'
};
function bounded(v:unknown,min:number,max:number,step:number,fallback:number):number {
  return typeof v==='number'&&Number.isFinite(v)
    ? Math.max(min,Math.min(max,Math.round(v/step)*step)) : fallback;
}
export function readClientPreferences():ClientPreferences {
  try {
    const stored=JSON.parse(localStorage.getItem(KEY)||'{}') as Partial<ClientPreferences>;
    return {
      layout:stored.layout==='studio'?'studio':'discord',
      avatarShape:stored.avatarShape==='rounded'?'rounded':'circle',
      activityWidth:bounded(stored.activityWidth,220,400,10,288),
      rowHeight:bounded(stored.rowHeight,48,84,2,62),
      saturation:bounded(stored.saturation,0,150,5,100),
      highContrast:stored.highContrast===true,
      fontScale:bounded(stored.fontScale,85,125,5,100),
      desktopFriendAlerts:stored.desktopFriendAlerts===true,
      showActivityPanel:stored.showActivityPanel!==false,
      messageSpacing:stored.messageSpacing==='compact'?'compact':'comfortable',
      messageStyle:stored.messageStyle==='cards'?'cards':'classic',
      sidebarWidth:bounded(stored.sidebarWidth,220,380,5,265),
      cornerRadius:bounded(stored.cornerRadius,4,24,2,12),
      serverIconScale:bounded(stored.serverIconScale,80,120,5,100),
      glowIntensity:bounded(stored.glowIntensity,0,100,5,70),
      backgroundPattern:stored.backgroundPattern==='grid'||stored.backgroundPattern==='dots'
        ?stored.backgroundPattern:'none'
    };
  }catch{return {...DEFAULT_CLIENT_PREFERENCES};}
}
export function saveClientPreferences(value:ClientPreferences) {
  try{ localStorage.setItem(KEY,JSON.stringify(value)); }catch {/* Storage may be unavailable */ }
}
