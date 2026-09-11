// storage-backup
// Back-up en integriteitscontrole van geüploade bestanden, binnen Supabase.
// Zie migratie 103. Aangeroepen door pg_cron (geen JWT → deploy met --no-verify-jwt):
//   { "mode": "sync" }    elk kwartier: nieuwe/gewijzigde objecten → backup-files
//   { "mode": "verify" }  elke nacht: blob achter elke metadata-rij aanwezig?
//                         nee → terugzetten uit back-up; verwijderde bronnen na
//                         30 dagen uit de back-up opruimen; mail bij problemen.
// Verwerkt per aanroep maximaal MAX_OPS kopieën zodat een run binnen de
// tijdslimiet blijft; de volgende cron-tick pakt de rest op.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  Deno.env.get('SB_SECRET_KEY') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@buuur.nl'
const FROM_NAME = Deno.env.get('FROM_NAME') || 'Buuur'
const ALERT_EMAIL = Deno.env.get('BACKUP_ALERT_EMAIL') || ''
const SOURCE_BUCKETS = (Deno.env.get('BACKUP_SOURCE_BUCKETS') || 'member-files,project-files,signatures,support-attachments,chat-attachments').split(',').map((s) => s.trim()).filter(Boolean)
const BACKUP_BUCKET = 'backup-files'
const MAX_OPS = Number(Deno.env.get('BACKUP_MAX_OPS') || '60')
const RETENTION_DAYS = Number(Deno.env.get('BACKUP_RETENTION_DAYS') || '30')

type Obj = { bucket: string; name: string; etag: string | null; size: number | null }
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

async function listAll(sb: SupabaseClient, bucket: string, prefix = ''): Promise<Obj[]> {
  const out: Obj[] = []
  let offset = 0
  while (true) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`)
    for (const e of data ?? []) {
      const p = prefix ? `${prefix}/${e.name}` : e.name
      if (e.id === null) out.push(...await listAll(sb, bucket, p))       // map
      else out.push({ bucket, name: p, etag: (e.metadata?.eTag as string) ?? null, size: (e.metadata?.size as number) ?? null })
    }
    if (!data || data.length < 1000) break
    offset += 1000
  }
  return out
}

async function blobExists(sb: SupabaseClient, bucket: string, name: string): Promise<boolean> {
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(name, 60)
  if (error || !data?.signedUrl) return false
  const r = await fetch(data.signedUrl, { method: 'HEAD' })
  return r.ok
}

async function copyObject(sb: SupabaseClient, from: { bucket: string; name: string }, to: { bucket: string; name: string }, contentType?: string): Promise<void> {
  const { data, error } = await sb.storage.from(from.bucket).download(from.name)
  if (error || !data) throw new Error(`download ${from.bucket}/${from.name}: ${error?.message || 'leeg'}`)
  const { error: upErr } = await sb.storage.from(to.bucket).upload(to.name, data, { upsert: true, contentType: contentType || data.type || 'application/octet-stream' })
  if (upErr) throw new Error(`upload ${to.bucket}/${to.name}: ${upErr.message}`)
}

async function sendAlert(subject: string, lines: string[]) {
  if (!RESEND_API_KEY || !ALERT_EMAIL) return
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;color:#1A1A2E"><p><b>${subject}</b></p><pre style="background:#F3F1ED;padding:12px;border-radius:8px;white-space:pre-wrap">${lines.map((l) => l.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))).join('\n')}</pre></div>`
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [ALERT_EMAIL], subject, html }),
  }).catch((e) => console.error('[storage-backup] mail mislukt', e))
}

Deno.serve(async (req) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return new Response('missing config', { status: 500 })
  let mode = 'sync'
  try { const b = await req.json(); if (b?.mode) mode = String(b.mode) } catch { /* default */ }
  if (!['sync', 'verify'].includes(mode)) return new Response('mode must be sync|verify', { status: 400 })

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: run } = await sb.from('storage_backup_runs').insert({ mode }).select('id').single()
  const stats = { checked: 0, copied: 0, missing: 0, restored: 0, unrecoverable: 0, pruned: 0 }
  const problems: string[] = []
  let ops = 0

  try {
    // Bestaande log in één keer ophalen.
    const { data: logRows } = await sb.from('storage_backup_log').select('source_bucket, name, etag, status, source_missing_since')
    const log = new Map<string, Row>((logRows ?? []).map((r: Row) => [`${r.source_bucket}/${r.name}`, r]))
    const seen = new Set<string>()

    for (const bucket of SOURCE_BUCKETS) {
      let objects: Obj[] = []
      try { objects = await listAll(sb, bucket) } catch (e) { problems.push(`bucket ${bucket}: ${(e as Error).message}`); continue }

      for (const o of objects) {
        const key = `${o.bucket}/${o.name}`
        seen.add(key)
        stats.checked++
        const entry = log.get(key)
        const backupName = key

        if (mode === 'sync') {
          // Nieuw of gewijzigd (etag anders) → kopiëren. Bekende 'unrecoverable' overslaan.
          if (entry && entry.status === 'unrecoverable') continue
          if (entry && entry.etag === o.etag && entry.status === 'ok') continue
          if (ops >= MAX_OPS) continue
          ops++
          try {
            if (!(await blobExists(sb, o.bucket, o.name))) {
              // Bron heeft geen blob: kunnen we niet kopiëren. Markeer; verify lost het op.
              await sb.from('storage_backup_log').upsert({ source_bucket: o.bucket, name: o.name, etag: o.etag, size: o.size, status: 'missing', note: 'bron zonder blob bij sync', updated_at: new Date().toISOString() })
              stats.missing++
              continue
            }
            await copyObject(sb, { bucket: o.bucket, name: o.name }, { bucket: BACKUP_BUCKET, name: backupName })
            await sb.from('storage_backup_log').upsert({ source_bucket: o.bucket, name: o.name, etag: o.etag, size: o.size, backed_up_at: new Date().toISOString(), status: 'ok', source_missing_since: null, note: null, updated_at: new Date().toISOString() })
            stats.copied++
          } catch (e) {
            problems.push(`kopiëren ${key}: ${(e as Error).message}`)
          }
        } else {
          // verify: bestaat de blob achter de metadata?
          const ok = await blobExists(sb, o.bucket, o.name)
          if (ok) {
            await sb.from('storage_backup_log').upsert({ source_bucket: o.bucket, name: o.name, etag: o.etag, size: o.size, last_verified_at: new Date().toISOString(), status: entry?.status === 'ok' || entry?.status === 'restored' ? entry.status : (entry?.backed_up_at ? 'ok' : 'pending'), source_missing_since: null, updated_at: new Date().toISOString() }, { ignoreDuplicates: false })
            continue
          }
          stats.missing++
          // Terugzetten uit back-up als die er is.
          if (entry?.backed_up_at && await blobExists(sb, BACKUP_BUCKET, backupName)) {
            try {
              await copyObject(sb, { bucket: BACKUP_BUCKET, name: backupName }, { bucket: o.bucket, name: o.name })
              await sb.from('storage_backup_log').upsert({ source_bucket: o.bucket, name: o.name, etag: o.etag, size: o.size, last_verified_at: new Date().toISOString(), status: 'restored', note: `hersteld uit back-up op ${new Date().toISOString()}`, updated_at: new Date().toISOString() })
              stats.restored++
              problems.push(`HERSTELD uit back-up: ${key}`)
            } catch (e) {
              problems.push(`herstel mislukt ${key}: ${(e as Error).message}`)
            }
          } else {
            stats.unrecoverable++
            if (entry?.status !== 'unrecoverable') problems.push(`ONHERSTELBAAR (geen blob, geen back-up): ${key}`)
            await sb.from('storage_backup_log').upsert({ source_bucket: o.bucket, name: o.name, etag: o.etag, size: o.size, last_verified_at: new Date().toISOString(), status: 'unrecoverable', note: 'blob ontbreekt en er is geen back-up', updated_at: new Date().toISOString() })
          }
        }
      }
    }

    if (mode === 'verify') {
      // Bronobjecten die verdwenen zijn (verwijderd door lid/beheerder): back-up 30 dagen bewaren, dan opruimen.
      const now = Date.now()
      for (const [key, entry] of log) {
        if (seen.has(key)) continue
        if (!entry.source_missing_since) {
          await sb.from('storage_backup_log').update({ status: 'source_deleted', source_missing_since: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('source_bucket', entry.source_bucket).eq('name', entry.name)
          continue
        }
        if (now - new Date(entry.source_missing_since).getTime() > RETENTION_DAYS * 86400_000) {
          await sb.storage.from(BACKUP_BUCKET).remove([key])
          await sb.from('storage_backup_log').delete().eq('source_bucket', entry.source_bucket).eq('name', entry.name)
          stats.pruned++
        }
      }
    }

    await sb.from('storage_backup_runs').update({ finished_at: new Date().toISOString(), ...stats, error: problems.length ? problems.slice(0, 50).join('\n') : null }).eq('id', run?.id)

    if (mode === 'verify' && (stats.missing > 0 || problems.length > 0)) {
      await sendAlert(
        `Bestandscontrole buuur: ${stats.restored} hersteld, ${stats.unrecoverable} onherstelbaar`,
        [`Gecontroleerd: ${stats.checked}`, `Ontbrekend: ${stats.missing}`, `Hersteld uit back-up: ${stats.restored}`, `Onherstelbaar: ${stats.unrecoverable}`, `Opgeruimd (30 dagen na verwijderen): ${stats.pruned}`, '', ...problems],
      )
    }
    return new Response(JSON.stringify({ ok: true, mode, ...stats, problems: problems.slice(0, 20) }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    await sb.from('storage_backup_runs').update({ finished_at: new Date().toISOString(), ...stats, error: (e as Error).message }).eq('id', run?.id)
    await sendAlert('Bestandsback-up buuur: run mislukt', [(e as Error).message])
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500 })
  }
})
