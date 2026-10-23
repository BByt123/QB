import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
const destination=path.resolve('dist');
if(destination!==path.join(process.cwd(),'dist'))throw new Error('Unexpected build destination.');
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});
for(const entry of ['index.html','styles.css','app.mjs','lib.mjs','rendering.mjs','word-preview.mjs','exports.mjs','preferences.mjs','taxonomy.mjs','assets','vendor','bank']) {
 await cp(entry,path.join(destination,entry),{recursive:true});
}
await writeFile(path.join(destination,'.nojekyll'),'');
console.log('Static GitHub Pages site prepared in dist/');
