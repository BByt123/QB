import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const packages = process.argv[2];
if (!packages) throw new Error('Usage: node scripts/vendor.mjs /path/to/node_modules');
await mkdir('vendor',{recursive:true});
const files = [
 ['pdfjs-dist/legacy/build/pdf.min.mjs','pdf.mjs'],
 ['pdfjs-dist/legacy/build/pdf.worker.min.mjs','pdf.worker.mjs'],
 ['pdf-lib/dist/pdf-lib.min.js','pdf-lib.js'],
 ['docx/dist/index.iife.js','docx.js'],
 ['lucide/dist/umd/lucide.min.js','lucide.js'],
];
for (const [source,destination] of files) await cp(path.join(packages,source),path.join('vendor',destination));
for (const folder of ['standard_fonts','wasm']) await cp(path.join(packages,'pdfjs-dist',folder),path.join('vendor',folder),{recursive:true});
const licenses=[];
for (const name of ['pdfjs-dist','pdf-lib','docx','lucide']) {
 const pkg=JSON.parse(await readFile(path.join(packages,name,'package.json'),'utf8'));
 let license='';
 for (const file of ['LICENSE','LICENSE.md','LICENSE.txt']) { try { license=await readFile(path.join(packages,name,file),'utf8'); break; } catch {} }
 licenses.push(`${name} ${pkg.version}\n${license}`);
}
await writeFile('vendor/LICENSES.txt',licenses.join('\n\n'));
console.log('Local browser dependencies prepared.');
