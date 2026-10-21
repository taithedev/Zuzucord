const {app,BrowserWindow,ipcMain,shell}=require('electron');
const path=require('node:path');
let notice;
function start(){
 notice=new BrowserWindow({width:680,height:660,backgroundColor:'#09090b',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 notice.loadFile('notice.html');
}
ipcMain.handle('continue',event=>{
 if(!notice||event.sender!==notice.webContents)return false;
 const discord=new BrowserWindow({width:1280,height:800,minWidth:800,minHeight:600,title:'ZuzuCord',backgroundColor:'#313338',autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,partition:'persist:discord'}});
 discord.webContents.setWindowOpenHandler(({url})=>{try{const u=new URL(url);if(u.protocol==='https:')shell.openExternal(url);}catch{}return {action:'deny'};});
 discord.webContents.on('will-navigate',(event,url)=>{try{const u=new URL(url);if(u.protocol!=='https:'||!['discord.com','www.discord.com','discord.gg','canary.discord.com','ptb.discord.com'].includes(u.hostname)){event.preventDefault();if(u.protocol==='https:')shell.openExternal(url);}}catch{event.preventDefault();}});
 discord.loadURL('https://discord.com/app');
 notice.close();notice=null;
 return true;
});
ipcMain.handle('exit',()=>app.quit());
app.whenReady().then(start);
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)start()});
