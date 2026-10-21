// Produce a proper Windows 256x256 ICO with a PNG-encoded image.
// The bundled 32x32 legacy ICO is too small for electron-builder.
// Reuse the existing project mascot artwork rather than a generic Electron icon.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

(async () => {
  const source = path.resolve(__dirname, '../../website/assets/zuzucord-icon.webp');
  const target = path.resolve(__dirname, '../assets/zuzucord.ico');
  if (!fs.existsSync(source)) throw Error('Missing ZuzuCord mascot image: ' + source);
  const png = await sharp(source).resize(256,256,{fit:'contain'}).png().toBuffer();
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0,0); header.writeUInt16LE(1,2); header.writeUInt16LE(1,4);
  const entry = Buffer.alloc(16);
  entry[0]=0; entry[1]=0; entry[2]=0; entry[3]=0;
  entry.writeUInt16LE(1,4); entry.writeUInt16LE(32,6);
  entry.writeUInt32LE(png.length,8); entry.writeUInt32LE(22,12);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,Buffer.concat([header,entry,png]));
  console.log('Created 256x256 ZuzuCord Windows icon from existing mascot art.');
})().catch(error => { console.error(error); process.exitCode=1; });
