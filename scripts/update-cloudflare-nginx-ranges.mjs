import { mkdir, rename, writeFile } from "node:fs/promises"
import path from "node:path"

const target = path.resolve(process.argv[2] || "nginx/generated")
const response = await fetch("https://api.cloudflare.com/client/v4/ips")
if (!response.ok) throw new Error(`Cloudflare IP API returned HTTP ${response.status}`)
const body = await response.json()
const ranges = [...(body.result?.ipv4_cidrs || []), ...(body.result?.ipv6_cidrs || [])]
const cidr = /^(?:[0-9a-f:.]+)\/[0-9]{1,3}$/i
if (ranges.length < 2 || ranges.some((range) => !cidr.test(range))) throw new Error("Cloudflare IP API returned invalid CIDRs")

await mkdir(target, { recursive: true })
const header = "# Generated from https://api.cloudflare.com/client/v4/ips - do not edit.\n"
const files = new Map([
  ["cloudflare-real-ip.conf", header + "real_ip_header CF-Connecting-IP;\nreal_ip_recursive off;\n" + ranges.map((range) => `set_real_ip_from ${range};`).join("\n") + "\n"],
  ["cloudflare-origin-peers.conf", header + ranges.map((range) => `${range} 1;`).join("\n") + "\n"],
])
for (const [name, content] of files) {
  const destination = path.join(target, name)
  const temporary = `${destination}.tmp`
  await writeFile(temporary, content, { mode: 0o644 })
  await rename(temporary, destination)
}
console.log(`Updated ${ranges.length} Cloudflare ranges in ${target}`)
