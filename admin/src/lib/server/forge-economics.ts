import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { detectEconomicsSpikes, summarizeForgeEconomics, type EconomicsUsageRow } from "@/lib/forge-economics"
import { forgeAiUsage, forgeArtifacts, forgeProjects, forgeTasks } from "@/lib/schema"
import { resolveForgeAiCostBudgetConfig } from "@/lib/forge-ai-usage"
import { getClientNamesByIds } from "./client-read-service"
import { getForgeProposalEconomics } from "./sales-read-service"

export interface EconomicsFilters { from?:string; to?:string; projectId?:number; clientId?:number; provider?:string; model?:string; stage?:string }
export async function loadForgeEconomics(filters:EconomicsFilters={}) {
  const raw = await db.select({ projectId:forgeAiUsage.projectId, projectName:forgeProjects.name, clientId:forgeProjects.clientId, stage:forgeTasks.agentType, provider:forgeAiUsage.provider, model:forgeAiUsage.model, cost:forgeAiUsage.estimatedCost, tokens:forgeAiUsage.totalTokens, completedAt:forgeAiUsage.completedAt, outputJson:forgeTasks.outputJson, resultQuality:forgeTasks.resultQuality }).from(forgeAiUsage).leftJoin(forgeProjects,eq(forgeProjects.id,forgeAiUsage.projectId)).leftJoin(forgeTasks,eq(forgeTasks.id,forgeAiUsage.taskId))
  const clientIds=[...new Set(raw.map((row)=>row.clientId).filter((id):id is number=>id!==null))]
  const [clientNames,projects,artifacts,proposalEconomics]=await Promise.all([getClientNamesByIds(clientIds),db.select({id:forgeProjects.id,status:forgeProjects.status}).from(forgeProjects),db.select({projectId:forgeArtifacts.projectId,approvalState:forgeArtifacts.approvalState}).from(forgeArtifacts),getForgeProposalEconomics(filters.clientId)])
  const rows:EconomicsUsageRow[]=raw.map((row)=>{const ai=(row.outputJson as {ai?:{latencyMs?:unknown,retries?:unknown}}|null)?.ai;return {projectId:row.projectId,projectName:row.projectName??"Unassigned",clientId:row.clientId,clientName:row.clientId?clientNames.get(row.clientId)??null:null,stage:row.stage??null,provider:row.provider,model:row.model,cost:Number(row.cost),tokens:row.tokens,completedAt:row.completedAt.toISOString(),retries:number(ai?.retries),latencyMs:nullableNumber(ai?.latencyMs),fallback:row.resultQuality==="fallback"||row.provider==="mock"}}).filter((row)=>matches(row,filters))
  const selectedProjects=new Set(rows.map((row)=>row.projectId).filter((id):id is number=>id!==null))
  const completedWebsites=projects.filter((p)=>selectedProjects.has(p.id)&&p.status==="deployed").length, approvedArtifacts=artifacts.filter((a)=>selectedProjects.has(a.projectId)&&["approved","system_validated"].includes(a.approvalState)).length
  const summary=summarizeForgeEconomics(rows,{completedWebsites,approvedArtifacts,...proposalEconomics})
  const projectCosts=new Map(summary.byProject.map((item)=>[item.label,item.cost])), limit=resolveForgeAiCostBudgetConfig().maxProjectAiCost
  const budgetAlerts=limit===null?[]:projects.flatMap((project)=>{const name=raw.find((row)=>row.projectId===project.id)?.projectName;const cost=name?projectCosts.get(name)??0:0;return cost/limit>=0.8?[`${name??`Project #${project.id}`} is at ${Math.round(cost/limit*100)}% of its estimated AI budget.`]:[]})
  return {summary,rows,alerts:[...detectEconomicsSpikes(summary.byDay),...budgetAlerts],filters,options:{projects:[...new Map(raw.filter(r=>r.projectId).map(r=>[r.projectId,{id:r.projectId!,name:r.projectName??`Project #${r.projectId}`}])).values()],clients:[...new Map(raw.filter(r=>r.clientId).map(r=>[r.clientId,{id:r.clientId!,name:clientNames.get(r.clientId!)??`Client #${r.clientId}`}])).values()],providers:[...new Set(raw.map(r=>r.provider))],models:[...new Set(raw.map(r=>r.model))],stages:[...new Set(raw.map(r=>r.stage).filter(Boolean))]}}
}
function matches(row:EconomicsUsageRow,f:EconomicsFilters){return (!f.from||row.completedAt>=`${f.from}T00:00:00`)&&(!f.to||row.completedAt<=`${f.to}T23:59:59.999Z`)&&(!f.projectId||row.projectId===f.projectId)&&(!f.clientId||row.clientId===f.clientId)&&(!f.provider||row.provider===f.provider)&&(!f.model||row.model===f.model)&&(!f.stage||row.stage===f.stage)}
function number(v:unknown){const n=Number(v);return Number.isFinite(n)&&n>0?n:0}function nullableNumber(v:unknown){const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
