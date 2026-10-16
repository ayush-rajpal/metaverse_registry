// Decides whether a pull request can be merged without a human: it must only ADD worlds (up to 5),
// each owned by the person who opened it, at an https address. Edits to or removals of existing
// worlds wait for review. Runs from the main branch (never the pull request's code) in auto-merge.yml;
// the "check" workflow separately confirms the new world's manifest loads and is valid.
// Env: GH_TOKEN, REPO (owner/name), PR (number), AUTHOR, HEAD_REPO, HEAD_SHA. Writes ok/reason to $GITHUB_OUTPUT.

import { appendFileSync, readFileSync } from 'node:fs'

const { GH_TOKEN, REPO, PR, AUTHOR, HEAD_REPO, HEAD_SHA, GITHUB_OUTPUT } = process.env

function decide(ok, reason) {
  console.log(`${ok ? 'eligible' : 'needs review'}: ${reason}`)
  // the reason can quote text from the pull request, so keep it to one short line
  const safe = reason.replace(/[\r\n]+/g, ' ').slice(0, 300)
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `ok=${ok}\nreason=${safe}\n`)
  process.exit(0)
}

const api = async (path) => {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`GitHub API ${path}: HTTP ${res.status}`)
  return res.json()
}

try {
  // 1. the only file changed is worlds.json
  const files = await api(`/repos/${REPO}/pulls/${PR}/files?per_page=100`)
  if (files.length !== 1 || files[0].filename !== 'worlds.json' || files[0].status !== 'modified')
    decide(false, 'it changes files other than worlds.json')

  // 2. compare the pull request's worlds.json (read as data) with main's
  const base = JSON.parse(readFileSync(new URL('./worlds.json', import.meta.url), 'utf8')).worlds
  const res = await fetch(`https://raw.githubusercontent.com/${HEAD_REPO}/${HEAD_SHA}/worlds.json`)
  const head = (await res.json()).worlds
  if (!Array.isArray(head)) decide(false, 'worlds.json has no "worlds" list')
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  for (const w of base) if (!head.some((h) => same(h, w))) decide(false, `it changes or removes the existing world "${w.id}"`)
  const added = head.filter((h) => !base.some((w) => same(h, w)))
  if (added.length < 1) decide(false, "it doesn't add a world")
  if (added.length > 5) decide(false, `it adds ${added.length} worlds; auto-merge handles up to 5 at a time`)

  // 3. each new world is owned by whoever opened the pull request, at a real https address
  // (the "check" workflow separately confirms each one's manifest loads and is valid)
  const author = (AUTHOR || '').toLowerCase()
  const ids = new Set(base.map((b) => b.id))
  for (const w of added) {
    if (!/^[a-z0-9_]{1,40}$/.test(w.id ?? '')) decide(false, `the id "${w.id}" must be 1-40 lowercase letters, digits or _`)
    if (ids.has(w.id)) decide(false, `the id "${w.id}" is taken`)
    ids.add(w.id)
    if (typeof w.name !== 'string' || !w.name.trim() || w.name.length > 40) decide(false, `the name of "${w.id}" must be 1-40 characters`)
    if ((w.owner || '').toLowerCase() !== author) decide(false, `"owner" of "${w.id}" must be your GitHub username (${AUTHOR})`)
    let ok = false
    try {
      const u = new URL(w.address)
      ok = u.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(u.hostname)
    } catch {
      // not a URL
    }
    if (!ok) decide(false, `the address of "${w.id}" must be a public https:// address`)
  }

  decide(true, `adds ${added.map((w) => `"${w.name}" (${w.id})`).join(', ')}`)
} catch (e) {
  decide(false, `the check couldn't run (${e.message})`)
}
