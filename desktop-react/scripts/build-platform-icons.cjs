// Generate native macOS and Linux app icons from ZuzuCord's original mascot.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const sharp=require('sharp');

(async()=>{
  const source=path.resolve(__dirname,'../../website/assets/zuzucord-icon.webp');
  const dest=path.resolve(__dirname,'../assets');
  if(!fs.existsSync(source))throw Error('Missing ZuzuCord icon source');
  fs.mkdirSync(dest,{recursive:true});
  await sharp(source).resize(1024,1024,{fit:'contain',background:'#101016'}).png()
    .toFile(path.join(dest,'zuzucord.png'));
  if(process.platform!=='darwin'){
    console.log('Generated 1024px Linux desktop icon.');
    return;
  }
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'zuzucord-icon-'));
  const iconset=path.join(temporary,'ZuzuCord.iconset');
  fs.mkdirSync(iconset);
  try{
    for(const base of [16,32,128,256,512]){
      await sharp(source).resize(base,base,{fit:'contain',background:'#101016'}).png()
        .toFile(path.join(iconset,`icon_${base}x${base}.png`));
      await sharp(source).resize(base*2,base*2,{fit:'contain',background:'#101016'}).png()
        .toFile(path.join(iconset,`icon_${base}x${base}@2x.png`));
    }
    const result=spawnSync('/usr/bin/iconutil',
      ['-c','icns',iconset,'-o',path.join(dest,'zuzucord.icns')],{stdio:'inherit'});
    if(result.status!==0)throw Error('macOS iconutil could not generate icon');
    console.log('Generated native macOS .icns and PNG icons.');
  }finally{fs.rmSync(temporary,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
