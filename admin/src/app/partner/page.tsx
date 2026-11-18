import { guardPageCapability } from '@/lib/server/rbac'
import { ExpansionWorkspace } from '@/components/expansion/ExpansionWorkspace'
export default async function PartnerPage() {
  await guardPageCapability('expansion.partner')
  return <ExpansionWorkspace />
}
