import { guardPageCapability } from '@/lib/server/rbac'
import { ExpansionWorkspace } from '@/components/expansion/ExpansionWorkspace'
export default async function ExpansionPage() {
  await guardPageCapability('expansion.manage')
  return <ExpansionWorkspace founder />
}
