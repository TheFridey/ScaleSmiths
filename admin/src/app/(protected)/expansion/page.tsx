import { guardPageCapability } from '@/lib/server/rbac'
import { ExpansionWorkspace } from '@/components/expansion/ExpansionWorkspace'
import { founderSalesCommandEnabled } from '@/lib/server/sales-command'
export default async function ExpansionPage() {
  await guardPageCapability('expansion.manage')
  return <ExpansionWorkspace founder commandCentre={founderSalesCommandEnabled()} />
}
