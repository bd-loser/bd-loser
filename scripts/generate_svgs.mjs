#!/usr/bin/env node
// Renders assets/id-card.svg and assets/desk.svg for the profile README.
// Zero dependencies — runs on a stock ubuntu runner via `node` directly.

import { mkdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const assets = join(root, "assets")
mkdirSync(assets, { recursive: true })

const TOKEN = process.env.GITHUB_TOKEN ?? ""
const USER = "bd-loser"
const CLIENT_REPO_LIST = ["opencode-bionic", "bun-termux", "claude-code-termux", "colab-mcp-termux"]

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const MONO = "ui-monospace,'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace"

const C = {
  bg: "#0d1117",
  panel: "#0d1117",
  bar: "#161b22",
  border: "#30363d",
  dotR: "#f85149",
  dotY: "#d29922",
  dotG: "#3fb950",
  text: "#e6edf3",
  muted: "#8b949e",
  key: "#79c0ff",
  green: "#3fb950",
  android: "#3ddc84",
  white: "#f0f6fc",
}

function terminalChrome(title, w, h, body) {
  return `
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="12" fill="${C.bg}" stroke="${C.border}" stroke-width="1"/>
  <path d="M1 13 a12 12 0 0 1 12 -12 h ${w - 24} a12 12 0 0 1 12 12 v 25 h -${w - 2} z" fill="${C.bar}"/>
  <line x1="1" y1="38.5" x2="${w - 1}" y2="38.5" stroke="${C.border}" stroke-width="1"/>
  <circle cx="24" cy="20" r="6" fill="${C.dotR}"/>
  <circle cx="44" cy="20" r="6" fill="${C.dotY}"/>
  <circle cx="64" cy="20" r="6" fill="${C.dotG}"/>
  <text x="${w / 2}" y="24.5" font-family="${MONO}" font-size="12.5" fill="${C.muted}" text-anchor="middle">${esc(title)}</text>
  ${body}`
}

function lines(x, startY, step, rows) {
  return rows
    .map((r, i) =>
      r.map(
        (t, j) =>
          `<text x="${x[j]}" y="${startY + i * step}" font-family="${MONO}" font-size="14" fill="${t[1]}">${esc(t[0])}</text>`,
      ),
    )
    .flat()
    .join("\n  ")
}

// ---------------------------------------------------------------- id card
function idCard() {
  const w = 880
  const h = 430
  const rowSpec = [
    [["os:", C.key], ["Android — Bionic, aarch64 (no glibc)", C.text]],
    [["kernel:", C.key], ["patched at the syscall level — seccomp-safe", C.text]],
    [["shell:", C.key], ["Termux + opencode", C.text]],
    [["focus:", C.key], ["runtimes · cross-compilation · release CI", C.text]],
    [["shipping:", C.key], ["bun-termux · opencode-bionic · @androidtui/*", C.text]],
    [["where:", C.key], ["Dhaka, Bangladesh — GMT+6", C.text]],
  ]
  const body = `
  <g fill="${C.android}">
    <line x1="128" y1="108" x2="115" y2="88" stroke="${C.android}" stroke-width="6" stroke-linecap="round"/>
    <line x1="172" y1="108" x2="185" y2="88" stroke="${C.android}" stroke-width="6" stroke-linecap="round"/>
    <path d="M104 150 A46 46 0 0 1 196 150 Z"/>
    <rect x="96" y="156" width="14" height="36" rx="7"/>
    <rect x="190" y="156" width="14" height="36" rx="7"/>
    <rect x="114" y="158" width="72" height="62" rx="16"/>
    <circle cx="134" cy="130" r="4.5" fill="${C.bg}"/>
    <circle cx="166" cy="130" r="4.5" fill="${C.bg}"/>
  </g>
  <text x="150" y="256" font-family="${MONO}" font-size="11.5" fill="${C.muted}" text-anchor="middle">no glibc</text>
  <text x="150" y="274" font-family="${MONO}" font-size="11.5" fill="${C.muted}" text-anchor="middle">no proot</text>
  <text x="150" y="292" font-family="${MONO}" font-size="11.5" fill="${C.muted}" text-anchor="middle">no LD_PRELOAD</text>
  <text x="300" y="86" font-family="${MONO}" font-size="17" font-weight="600" fill="${C.green}">bd-loser<tspan fill="${C.muted}" font-weight="400"> @ aarch64-linux-android</tspan></text>
  ${lines([300, 424], 132, 30, rowSpec)}`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${terminalChrome("aman@android — ~/profile", w, h, body)}
</svg>`
}

// ---------------------------------------------------------------- desk
function relAge(iso) {
  if (!iso) return "unknown"
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

async function gh(path) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "profile-svg" }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`
  const res = await fetch(`https://api.github.com${path}`, { headers })
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json()
}

async function deskData() {
  const data = { push: null, release: null }
  try {
    const events = await gh(`/users/${USER}/events/public?per_page=40`)
    const push = events.find((e) => e.type === "PushEvent")
    if (push) data.push = { repo: push.repo.name.split("/")[1], at: push.created_at }
  } catch {}
  const releases = await Promise.allSettled(
    CLIENT_REPO_LIST.map((r) => gh(`/repos/${USER}/${r}/releases/latest`)),
  )
  let best = null
  for (let i = 0; i < releases.length; i++) {
    const r = releases[i]
    if (r.status !== "fulfilled") continue
    if (!best || new Date(r.value.published_at) > new Date(best.published_at)) {
      best = { ...r.value, repo: CLIENT_REPO_LIST[i] }
    }
  }
  if (best) data.release = { repo: best.repo, tag: best.tag_name, at: best.published_at }
  return data
}

function statusLine(pushAge, releaseAge) {
  const hrs = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 36e5 : Infinity)
  if (hrs(pushAge) < 24) return "shipping — latest build moving out to users"
  if (hrs(releaseAge) < 48) return "fresh release out — watching for issues"
  return "between ports — planning the next build"
}

async function desk() {
  const w = 880
  const h = 214
  const data = await deskData()
  const pushAge = data.push ? relAge(data.push.at) : "unknown"
  const pushLine = data.push ? `${data.push.repo} · ${pushAge}` : "quiet for a while"
  const relAgeStr = data.release ? relAge(data.release.at) : "—"
  const relLine = data.release ? `${data.release.repo} ${data.release.tag} · ${relAgeStr}` : "no releases yet"
  const now = new Date()
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now)
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka", weekday: "short", day: "2-digit", month: "short", year: "numeric",
  }).format(now)

  const body = `
  <text x="24" y="112" font-family="${MONO}" font-size="46" font-weight="700" fill="${C.white}">${esc(time)}</text>
  <text x="24" y="140" font-family="${MONO}" font-size="13" fill="${C.muted}">${esc(date)} — GMT+6 · Dhaka</text>
  <text x="330" y="70" font-family="${MONO}" font-size="11" letter-spacing="1.5" fill="${C.muted}">LAST PUSH</text>
  <text x="330" y="92" font-family="${MONO}" font-size="14.5" fill="${C.text}">${esc(pushLine)}</text>
  <text x="330" y="124" font-family="${MONO}" font-size="11" letter-spacing="1.5" fill="${C.muted}">LATEST RELEASE</text>
  <text x="330" y="146" font-family="${MONO}" font-size="14.5" fill="${C.text}">${esc(relLine)}</text>
  <text x="330" y="178" font-family="${MONO}" font-size="11" letter-spacing="1.5" fill="${C.muted}">STATUS</text>
  <circle cx="340" cy="202" r="4" fill="${C.green}">
    <animate attributeName="opacity" values="1;0.25;1" dur="2s" repeatCount="indefinite"/>
  </circle>
  <text x="354" y="207" font-family="${MONO}" font-size="14.5" fill="${C.text}">${esc(statusLine(data.push?.at, data.release?.at))}</text>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${terminalChrome("aman@android — ~/now", w, h, body)}
</svg>`
}

writeFileSync(join(assets, "id-card.svg"), idCard())
writeFileSync(join(assets, "desk.svg"), await desk())
console.log("wrote assets/id-card.svg and assets/desk.svg")
