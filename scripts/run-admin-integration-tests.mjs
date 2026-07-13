import { spawn } from "node:child_process"
import process from "node:process"
import path from "node:path"

const root = process.cwd()
const compose = ["compose","-p","scalesmiths-integration-test","-f","docker-compose.integration-test.yml"]
const databaseUrl = process.env.TEST_DATABASE_URL ?? "postgresql://scalesmiths_test:scalesmiths_test_only@127.0.0.1:55432/scalesmiths_integration_test"
try {
  await command("docker",[...compose,"up","-d","--wait"],root)
  const npmExecutable=process.platform==="win32"?(process.env.ComSpec??"cmd.exe"):"npm"
  const npmArgs=process.platform==="win32"?["/d","/s","/c","npm run test:integration"]:["run","test:integration"]
  await command(npmExecutable,npmArgs,path.join(root,"admin"),{...process.env,TEST_DATABASE_URL:databaseUrl})
} finally {
  await command("docker",[...compose,"down","--volumes"],root).catch((error)=>console.error(`Integration database cleanup failed: ${error.message}`))
}
function command(executable,args,cwd,env=process.env){return new Promise((resolve,reject)=>{const child=spawn(executable,args,{cwd,env,stdio:"inherit",windowsHide:true});child.once("error",reject);child.once("exit",code=>code===0?resolve():reject(new Error(`${executable} exited with ${code}`)))})}
