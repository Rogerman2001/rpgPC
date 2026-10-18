import {build} from 'esbuild';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
try{process.loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}
const url=process.env.VITE_SUPABASE_URL||'',key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'';
if(key.startsWith('sb_secret_'))throw Error('Never use a secret key in a browser build');
if(key&&!key.startsWith('sb_publishable_')&&key.split('.').length!==3)throw Error('Expected a publishable or anon key');
if(key.split('.').length===3){try{if(JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role!=='anon')throw Error('Only anon JWT keys are allowed');}catch{throw Error('Invalid public key');}}
await mkdir('dist',{recursive:true});
await build({entryPoints:['js/bootstrap.js','js/advice-worker.js'],outdir:'dist/js',bundle:true,format:'esm',splitting:true,target:'es2022',define:{'__SUPABASE_URL__':JSON.stringify(url),'__SUPABASE_KEY__':JSON.stringify(key)}});
await copyFile('styles.css','dist/styles.css');await copyFile('account.css','dist/account.css');
await writeFile('dist/index.html',await readFile('index.html','utf8'));
console.log(url&&key?'Build ready; verify SQL/OAuth setup before deployment.':'Build ready with closed login gate: Supabase configuration missing.');
