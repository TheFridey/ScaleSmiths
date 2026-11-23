import { test, expect, type Browser, type BrowserContext } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { mkdir } from "node:fs/promises"
import { generateTotp } from "../../src/lib/server/mfa"
const base=process.env.EMPOWER_ADMIN_BASE_URL, db=process.env.EMPOWER_BROWSER_DATABASE_URL
test.skip(!base || !db, "An explicit disposable production admin server and PostgreSQL are required.")
const PASSWORD="Empower-Demo-Only-2026"
const founder="empower-founder-a@example.invalid",partner="empower-partner-one@example.invalid"
const widths=[320,390,768,1024,1440,1920]
function origin(){
  const a=new URL(base!), d=new URL(db!)
  if(!["localhost","127.0.0.1"].includes(a.hostname)||a.port!=="3103"||!["localhost","127.0.0.1"].includes(d.hostname)||d.pathname!=="/ss_empower_browser_e2e")
    throw Error("Refusing a non-disposable B2.6 browser environment.")
  return a.origin
}
async function login(browser:Browser,email:string,mfa?:string){
  const context=await browser.newContext(),page=await context.newPage()
  await page.goto(origin()+"/login")
  await page.getByLabel("Email",{exact:true}).fill(email)
  await page.getByLabel("Password",{exact:true}).fill(PASSWORD)
  if(mfa)await page.getByLabel(/^Authenticator code/).fill(generateTotp(mfa))
  await page.getByRole("button",{name:"Sign in",exact:true}).click()
  await page.waitForURL(/\/(partner|dashboard|command-centre)/)
  return {context,page}
}
const api=async(context:BrowserContext,url:string,data?:Record<string,unknown>)=>{
  const r=data?await context.request.post(origin()+url,{headers:{origin:origin()},data}):await context.request.get(origin()+url,{maxRedirects:0})
  return {status:r.status(),body:await r.json().catch(()=>({}))}
}
test("B2.6 founder delivery handoff is explicit, partner view is isolated and pages are accessible",async({browser})=>{
  origin()
  const f=await login(browser,founder,"JBSWY3DPEHPK3PXP")
  const p=await login(browser,partner)
  const anonymous=await browser.newContext()
  const evidence="../docs/expansion/ascend/evidence/b2-6"
  await mkdir(evidence,{recursive:true})
  try{
    expect((await api(anonymous,"/api/expansion/handoffs")).status).not.toBe(200)
    expect((await api(p.context,"/api/expansion/handoffs")).status).not.toBe(200)
    expect((await api(f.context,"/api/partner/handoffs")).status).not.toBe(200)
    const founderQueue=await api(f.context,"/api/expansion/handoffs")
    expect(founderQueue.status).toBe(200)
    expect(Array.isArray(founderQueue.body.candidates)).toBe(true)
    const own=await api(p.context,"/api/partner/handoffs")
    expect(own.status).toBe(200)
    expect(Array.isArray(own.body.handoffs)).toBe(true)
    expect(JSON.stringify(own.body)).not.toContain("founder_reason")
    expect(JSON.stringify(own.body)).not.toContain("scope_snapshot")
    expect((await api(f.context,"/api/expansion/handoffs",{action:"approve",confirm:false,reason:"invalid approval",opportunityId:"30000000-0000-4000-8000-000000000001",expectedContractId:"40000000-0000-4000-8000-000000000001"})).status).toBe(400)
    await f.page.goto(origin()+"/expansion/handoffs")
    await expect(f.page.getByRole("heading",{name:"Sales-to-delivery handoffs"})).toBeVisible()
    await expect(f.page.getByText(/does not publish anything to the client/)).toBeVisible()
    for(const width of widths){
      await f.page.setViewportSize({width,height:900})
      expect(await f.page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
      await f.page.screenshot({path:evidence+"/founder-"+width+".png",fullPage:true})
    }
    const access=await new AxeBuilder({page:f.page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze()
    expect(access.violations.filter(x=>["critical","serious"].includes(String(x.impact)))).toEqual([])
    await p.page.goto(origin()+"/partner/handoffs")
    await expect(p.page.getByRole("heading",{name:"Delivery handoffs"})).toBeVisible()
    await expect(p.page.getByText(/founder notes and technical details remain private/)).toBeVisible()
    expect((await api(p.context,"/api/expansion/handoffs",{action:"approve",confirm:true,reason:"I approve another partner deal",opportunityId:"30000000-0000-4000-8000-000000000001",expectedContractId:"40000000-0000-4000-8000-000000000001"})).status).not.toBe(200)
  }finally{await Promise.all([f.context.close(),p.context.close(),anonymous.close()])}
})
