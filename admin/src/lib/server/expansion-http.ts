import 'server-only'
import { NextResponse } from 'next/server'
import { ExpansionError } from '@/lib/expansion'
import { ExpansionFinanceError } from '@/lib/expansion-finance'
import { AdminIdentityError } from '@/lib/admin-users'
export const expansionHeaders = {'Cache-Control':'private, no-store, max-age=0'}
export async function expansionBody(request: Request) {
  const expected = new URL(process.env.AUTH_URL || request.url).origin
  if (request.headers.get('origin') !== expected) throw new ExpansionError('Same-origin requests are required.',403)
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ExpansionError('JSON is required.',415)
  const reader = request.body?.getReader()
  if (!reader) throw new ExpansionError('Request body is required.')
  const parts: Uint8Array[] = []; let total = 0
  while (true) {
    const {done,value} = await reader.read()
    if (done) break
    total += value.byteLength
    if (total>65536) { await reader.cancel(); throw new ExpansionError('Request is too large.',413) }
    parts.push(value)
  }
  let result: unknown
  try { result = JSON.parse(Buffer.concat(parts).toString('utf8')) } catch { throw new ExpansionError('Invalid JSON.') }
  if (!result || typeof result!=='object' || Array.isArray(result)) throw new ExpansionError('An object is required.')
  return result as Record<string,unknown>
}
export function expansionFailure(error: unknown) {
  if (error instanceof ExpansionError || error instanceof ExpansionFinanceError || error instanceof AdminIdentityError) return NextResponse.json({error:error.message},{status:error.status,headers:expansionHeaders})
  const code = (error as {code?:string;cause?:{code?:string}})?.code || (error as {cause?:{code?:string}})?.cause?.code
  if (code==='23505') return NextResponse.json({error:'This business or reference already has an existing ScaleSmiths relationship. Contact commercial support for review.'},{status:409,headers:expansionHeaders})
  console.error('Expansion request unavailable',{code:code || 'unavailable'})
  return NextResponse.json({error:'The partner workspace is unavailable. Check database connectivity and shared migrations.'},{status:503,headers:expansionHeaders})
}
