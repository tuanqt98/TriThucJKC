// Format encoding only: preserve the generated composition and pixel dimensions.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('../../starter/apps/web/node_modules/sharp');
(async () => {
  const entries=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const root=path.resolve(__dirname,'../..');
  const target=path.join(root,'starter/apps/web/public/images/dashboard-demo');
  fs.mkdirSync(target,{recursive:true});
  const manifest=[];
  for(const {name,prompt,path:source} of entries){
    const dest=path.join(target,name+'.webp');
    if(fs.existsSync(dest))throw new Error('Refusing to overwrite '+dest);
    const data=await sharp(source).webp({quality:84,effort:5}).toBuffer({resolveWithObject:true});
    fs.writeFileSync(dest,data.data);
    manifest.push({name,file:path.relative(root,dest),prompt,mode:'built-in image_gen',synthetic_demo:true,width:data.info.width,height:data.info.height,bytes:data.info.size,encoding:'WebP quality 84; no resize, crop, or scene edit',sha256:crypto.createHash('sha256').update(data.data).digest('hex'),source_sha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')});
  }
  fs.writeFileSync(path.join(root,'docs/reports/ui-02/image-prompts.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log('Saved '+manifest.length+' generated DEMO assets; '+manifest.reduce((total,x)=>total+x.bytes,0)+' bytes total.');
})().catch(e=>{console.error(e.message);process.exit(1);});
