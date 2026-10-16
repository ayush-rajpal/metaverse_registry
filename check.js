// Checks every world in worlds.json: does its manifest load, and is it valid mvw/0.1?
// Usage: node check.js            (Node 18 or newer; no packages needed)
//        WORLDS_URL=<url> node check.js   checks a list fetched from that address instead (the CI uses
//        this for pull requests: it reads the proposed worlds.json as data and never runs its code)
// Exits with code 1 if any world fails, so it can run on pull requests in CI.

import { readFileSync } from 'node:fs'

async function loadList() {
  if (!process.env.WORLDS_URL) return JSON.parse(readFileSync(new URL('./worlds.json', import.meta.url), 'utf8'))
  const res = await fetch(process.env.WORLDS_URL, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`couldn't fetch ${process.env.WORLDS_URL} (HTTP ${res.status})`)
  return res.json()
}
let registry
try {
  registry = await loadList()
  if (!Array.isArray(registry?.worlds)) throw new Error('worlds.json has no "worlds" list')
} catch (e) {
  console.log(`✗ ${e.message}`)
  process.exit(1)
}
const isWebAddress = (s) => {
  try {
    return /^https?:$/.test(new URL(s).protocol)
  } catch {
    return false
  }
}

// problems with a registry entry itself
function checkEntry(w, seen) {
  const problems = []
  if (!/^[a-z0-9_]{1,40}$/.test(w.id ?? '')) problems.push('id must be 1-40 lowercase letters, digits or _')
  if (seen.has(w.id)) problems.push(`duplicate id "${w.id}"`)
  if (!isWebAddress(w.address)) problems.push('address must be an http(s) URL')
  if (typeof w.name !== 'string' || !w.name) problems.push('name is missing')
  return problems
}

// problems with a world's manifest (PROTOCOL.md section 1)
function checkManifest(m) {
  const problems = []
  if (m.protocol !== 'mvw/0.1') problems.push(`protocol is ${JSON.stringify(m.protocol)}, expected "mvw/0.1"`)
  if (typeof m.name !== 'string' || !m.name) problems.push('name is missing')
  if (!m.spawns || typeof m.spawns !== 'object') problems.push('spawns is missing')
  else if (!('default' in m.spawns)) problems.push('spawns has no "default"')
  if (m.portals !== undefined) {
    if (!Array.isArray(m.portals)) problems.push('portals must be a list')
    else
      m.portals.forEach((p, i) => {
        if (!isWebAddress(p?.href)) problems.push(`portals[${i}].href is not an http(s) URL`)
        if (p?.spawn !== undefined && typeof p.spawn !== 'string') problems.push(`portals[${i}].spawn must be text`)
      })
  }
  return problems
}

const seen = new Set()
let failed = 0
for (const w of registry.worlds) {
  const problems = checkEntry(w, seen)
  seen.add(w.id)
  let name = w.name
  if (!problems.length) {
    const url = new URL('.well-known/metaverse.json', w.address)
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (!res.ok) problems.push(`manifest returned HTTP ${res.status} (${url})`)
      else {
        const m = await res.json()
        problems.push(...checkManifest(m))
        if (m.name && m.name !== w.name) name = `${w.name} (manifest says "${m.name}")`
        if (!res.headers.get('access-control-allow-origin')) problems.push('warning: no Access-Control-Allow-Origin header; browsers on other sites can\'t read the manifest')
      }
    } catch (e) {
      problems.push(`manifest didn't load: ${e.name === 'TimeoutError' ? 'timed out' : e.cause?.code || e.message} (${url})`)
    }
  }
  const errors = problems.filter((p) => !p.startsWith('warning'))
  if (errors.length) failed++
  console.log(`${errors.length ? '✗' : '✓'} ${w.id.padEnd(20)} ${name}  ${w.address}`)
  for (const p of problems) console.log(`    ${p}`)
}
console.log(`\n${registry.worlds.length - failed} of ${registry.worlds.length} worlds OK`)
process.exitCode = failed ? 1 : 0
