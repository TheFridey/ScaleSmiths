// Run on the ScaleSmiths host after the reviewed read API has been deployed.
// Creates a dedicated read-only token file; prints no token or database URL.
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, chmodSync, existsSync } from 'node:fs';
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
const adminId=value('--admin-id');
const principalId=value('--principal-id')??'principal-operator';
if(!/^[A-Za-z0-9._:-]{1,200}$/.test(principalId))throw new Error('Invalid JARVIS principal ID.');
const require=createRequire(new URL('../admin/package.json',import.meta.url));
const {Client}=require('pg');
const client=new Client({connectionString:process.env.ADMIN_DATABASE_URL,connectionTimeoutMillis:10000});
try {
  await client.connect();
  const {rows}=await client.query('select id,session_version from admin_users where active=true and role=\'owner\' and ($1::text is null or id::text=$1) order by id limit 2',[adminId??null]);
  if(rows.length!==1)throw new Error('Specify --admin-id for exactly one active owner. No token was provisioned.');
  const scopes=['clients','leads','projects','tasks','invoices','payments','retainers','proposals','analytics','deployments'].map(area=>area+'.read');
  const token=randomBytes(48).toString('base64url');
  const configPath=root+'jarvis.integrations.local.json';
  // Never replace another provider configuration; the transferred file is a
  // ScaleSmiths-only fragment for the local Kernel credential configuration.
  writeFileSync(configPath,JSON.stringify({scalesmiths:{principalId,baseUrl:'https://admin.scalesmiths.co.uk/api/jarvis/',token,contractVersion:1,readActions:scopes,mutations:[]},writeScopes:[]},null,2),{mode:0o600});
  chmodSync(configPath,0o600);
  let contents=existsSync(envPath)?readFileSync(envPath,'utf8'):'';
  const settings={JARVIS_SERVICE_TOKEN_SHA256:createHash('sha256').update(token).digest('hex'),JARVIS_SERVICE_ADMIN_ID:rows[0].id,JARVIS_SERVICE_SESSION_VERSION:String(rows[0].session_version),JARVIS_SERVICE_SCOPES:scopes.join(',')};
  for(const [key,val] of Object.entries(settings)){
    const pattern=new RegExp('^'+key+'=.*$','m');
    contents=pattern.test(contents)?contents.replace(pattern,key+'='+val):contents+'\n'+key+'='+val;
  }
  const temporary=envPath+'.jarvis.tmp';
  writeFileSync(temporary,contents,{mode:0o600});chmodSync(temporary,0o600);renameSync(temporary,envPath);
  console.log('Read-only service provisioned for the selected active owner. Token digest saved to server .env.');
  console.log('Protected credential fragment: '+configPath);
  console.log('Restart the admin app through its existing process manager, then securely copy the fragment to JARVIS. Never paste it into chat.');
} finally {await client.end();}
