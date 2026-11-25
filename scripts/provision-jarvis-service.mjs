// Run on the ScaleSmiths host after the reviewed read API has been deployed.
// Creates a dedicated read-only token file; prints no token or database URL.
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, renameSync, existsSync, openSync, writeSync, fsyncSync, closeSync, fchmodSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
const root = fileURLToPath(new URL('../', import.meta.url));
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if(existsSync(envPath))loadEnvFile(envPath);
const args = process.argv.slice(2);
if(!args.includes('--apply'))throw new Error('Use --apply to provision the dedicated read-only JARVIS service. This rotates an existing JARVIS token.');
if(!process.env.ADMIN_DATABASE_URL)throw new Error('ADMIN_DATABASE_URL must be configured on this host.');
const value = name => {const index=args.indexOf(name);return index>=0?args[index+1]:undefined;};
// Write a secret file so the bytes are never readable by another user, even for
// the instant between creation and chmod. `mode` on writeFileSync only applies
// when the file is created, so an existing 0644 file would receive the token
// before chmodSync narrowed it. fchmodSync runs before the first byte is written.
function writeSecretFile(path, data){
  const temporary=path+'.tmp';
  const fd=openSync(temporary,'w',0o600);
  try {
    fchmodSync(fd,0o600);
    writeSync(fd,data);
    fsyncSync(fd);
  } finally { closeSync(fd); }
  renameSync(temporary,path);
  // Durability: the rename must survive a crash, so sync the directory too.
  try { const dir=openSync(path.replace(/[^/]+$/,''),'r'); try { fsyncSync(dir); } finally { closeSync(dir); } } catch {}
}
const adminId=value('--admin-id');
const principalId=value('--principal-id')??'principal-operator';
if(!/^[A-Za-z0-9._:-]{1,200}$/.test(principalId))throw new Error('Invalid JARVIS principal ID.');
// Explicit list: the communications actions are opt-in and one of them contains
// a hyphen, so they are not produced by a naive `<area>.read` map.
const DEFAULT_AREAS=['clients','leads','projects','tasks','invoices','payments','retainers','proposals','analytics','deployments'];
const COMMUNICATIONS_ACTIONS=['messages.read','enquiries.read','partner-applications.read','partner-requests.read'];
const requested=value('--scopes');
// Scopes must be stated explicitly. A default would silently grant the financial
// read areas to a token provisioned for communications, which is the opposite of
// least privilege, and would also silently drop the communications actions.
if(!requested)throw new Error('Specify --scopes explicitly. There is no default scope set, because a default would grant financial read areas to a communications token.');
const scopes=requested.split(',').map(s=>s.trim()).filter(Boolean);
if(!scopes.length)throw new Error('--scopes must name at least one read scope.');
const allowed=new Set([...DEFAULT_AREAS.map(area=>area+'.read'),...COMMUNICATIONS_ACTIONS]);
for(const scope of scopes)if(!allowed.has(scope))throw new Error('Unknown read scope: '+scope);
const require=createRequire(new URL('../admin/package.json',import.meta.url));
const {Client}=require('pg');
const client=new Client({connectionString:process.env.ADMIN_DATABASE_URL,connectionTimeoutMillis:10000});
try {
  await client.connect();
  const {rows}=await client.query('select id,session_version from admin_users where active=true and role=\'owner\' and ($1::text is null or id::text=$1) order by id limit 2',[adminId??null]);
  if(rows.length!==1)throw new Error('Specify --admin-id for exactly one active owner. No token was provisioned.');
  const token=randomBytes(48).toString('base64url');
  const configPath=root+'jarvis.integrations.local.json';
  // Never replace another provider configuration; the transferred file is a
  // ScaleSmiths-only fragment for the local Kernel credential configuration.
  writeSecretFile(configPath,JSON.stringify({scalesmiths:{principalId,baseUrl:'https://admin.scalesmiths.co.uk/api/jarvis/',token,contractVersion:1,readActions:scopes,mutations:[]},writeScopes:[]},null,2));
  let contents=existsSync(envPath)?readFileSync(envPath,'utf8'):'';
  const settings={JARVIS_SERVICE_TOKEN_SHA256:createHash('sha256').update(token).digest('hex'),JARVIS_SERVICE_ADMIN_ID:rows[0].id,JARVIS_SERVICE_SESSION_VERSION:String(rows[0].session_version),JARVIS_SERVICE_SCOPES:scopes.join(',')};
  // Replace ALL existing occurrences, not the first. `String.replace` with a
  // non-global regex rewrites only the first matching line, so a .env holding a
  // duplicate JARVIS_SERVICE_SCOPES kept its stale second line, and Node's
  // loadEnvFile resolves a duplicate key to the LAST one - silently reinstating
  // the previous scope set. Every earlier line for the key is dropped and
  // exactly one is appended, so the file cannot end up with two.
  function setOnce(text,key,val){
    const lines=text.split('\n');
    const prefix=key+'=';
    const kept=lines.filter(line=>!line.startsWith(prefix));
    const removed=lines.length-kept.length;
    if(removed>1)console.warn('Removed '+removed+' duplicate '+key+' lines; only the newly written value is kept.');
    while(kept.length&&kept[kept.length-1]==='')kept.pop();
    kept.push(prefix+val);
    return kept.join('\n')+'\n';
  }
  for(const [key,val] of Object.entries(settings))contents=setOnce(contents,key,val);
  writeSecretFile(envPath,contents);
  console.log('Read-only service provisioned for the selected active owner. Token digest saved to server .env.');
  console.log('Granted read scopes: '+scopes.join(', '));
  console.log('Protected credential fragment: '+configPath);
  console.log('Restart the admin app through its existing process manager, then securely copy the fragment to JARVIS. Never paste it into chat.');
} finally {await client.end();}
