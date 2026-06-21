import { deflateRawSync } from "node:zlib"

export interface ForgeZipEntry {
  path: string
  content: string | Buffer
}

const SIG_LOCAL = 0x04034b50
const SIG_CENTRAL = 0x02014b50
const SIG_EOCD = 0x06054b50
// General purpose bit 11 → filenames/comments are UTF-8.
const FLAG_UTF8 = 0x0800
// Fixed DOS timestamp (1980-01-01 00:00:00) so archives are reproducible.
const DOS_TIME = 0
const DOS_DATE = 0x0021

/**
 * Builds a ZIP archive in memory with no external dependencies. Uses raw DEFLATE via node:zlib,
 * falling back to STORE when compression does not help. Suitable for the small text-based
 * generated-site and handover-pack exports.
 */
export function createForgeZipArchive(entries: ForgeZipEntry[]): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0
  let count = 0

  for (const entry of entries) {
    const nameBuffer = Buffer.from(normalizeEntryPath(entry.path), "utf8")
    const data = typeof entry.content === "string" ? Buffer.from(entry.content, "utf8") : entry.content
    const crc = crc32(data)
    const deflated = deflateRawSync(data)
    const useDeflate = deflated.length < data.length
    const method = useDeflate ? 8 : 0
    const stored = useDeflate ? deflated : data

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(SIG_LOCAL, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(FLAG_UTF8, 6)
    localHeader.writeUInt16LE(method, 8)
    localHeader.writeUInt16LE(DOS_TIME, 10)
    localHeader.writeUInt16LE(DOS_DATE, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(stored.length, 18)
    localHeader.writeUInt32LE(data.length, 22)
    localHeader.writeUInt16LE(nameBuffer.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localParts.push(localHeader, nameBuffer, stored)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(SIG_CENTRAL, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(FLAG_UTF8, 8)
    centralHeader.writeUInt16LE(method, 10)
    centralHeader.writeUInt16LE(DOS_TIME, 12)
    centralHeader.writeUInt16LE(DOS_DATE, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(stored.length, 20)
    centralHeader.writeUInt32LE(data.length, 24)
    centralHeader.writeUInt16LE(nameBuffer.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)

    centralParts.push(centralHeader, nameBuffer)

    offset += localHeader.length + nameBuffer.length + stored.length
    count += 1
  }

  const centralDirectory = Buffer.concat(centralParts)
  const localData = Buffer.concat(localParts)

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(SIG_EOCD, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(count, 8)
  eocd.writeUInt16LE(count, 10)
  eocd.writeUInt32LE(centralDirectory.length, 12)
  eocd.writeUInt32LE(localData.length, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([localData, centralDirectory, eocd])
}

function normalizeEntryPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "")
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}
