// Dependency-free packager for this project's named ES-module imports/exports.
// Keeps source modules authoritative; regenerate after changing the game.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
async function bundle(entry,transform=s=>s){
  const visited=new Set(),parts=['const modules=Object.create(null);'];
  async function visit(name){
    if(visited.has(name))return;visited.add(name);
    let source=await readFile(resolve(root,'js',name),'utf8');
    const dependencies=[...source.matchAll(/^import\s*\{([^}]+)\}\s*from\s*'\.\/([^']+)';/gm)];
    for(const match of dependencies)await visit(match[2]);
    const exported=[...source.matchAll(/^export\s+(?:function|class|const)\s+(\w+)/gm)].map(m=>m[1]);
    source=source.replace(/^import\s*\{([^}]+)\}\s*from\s*'\.\/([^']+)';/gm,(_,names,file)=>`const {${names.replace(/\s+as\s+/g,':')}}=modules[${JSON.stringify(file)}];`)
      .replace(/^export\s+/gm,'');
    source=transform(source,name);
    if(/^import\s|^export\s/m.test(source)||source.includes('import.meta'))throw Error('Unsupported module syntax: '+name);
    const asyncPrefix=name==='app.js'?'await (async':'(';
    parts.push(`modules[${JSON.stringify(name)}]=${asyncPrefix}()=>{\n${source}\nreturn {${exported.join(',')}};\n})();`);
  }
  await visit(entry);return parts.join('\n');
}
const worker=await bundle('advice-worker.js');
const app=await bundle('app.js',(source,name)=>name==='app.js'?source.replace(
  "new Worker(new URL('./advice-worker.js',import.meta.url),{type:'module'})",
  `createPortableWorker()`):source);
const workerFactory=`function createPortableWorker(){const url=URL.createObjectURL(new Blob([${JSON.stringify(worker)}],{type:'text/javascript'}));try{return new Worker(url);}finally{URL.revokeObjectURL(url);}}`;
let html=await readFile(resolve(root,'index.html'),'utf8');
const css=await readFile(resolve(root,'styles.css'),'utf8');
html=html.replace('<link rel="stylesheet" href="styles.css">',()=>`<style>${css}</style>`)
  .replace('<script type="module" src="js/app.js"></script>',()=>`<script type="module">${(workerFactory+'\n'+app).replace(/<\/script/gi,'<\\/script')}</script>`);
await writeFile(resolve(root,'CavernaBURX.html'),html);
console.log('CavernaBURX.html: portable game, styles and local advice worker included.');
