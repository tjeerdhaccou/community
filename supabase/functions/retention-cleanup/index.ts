// retention-cleanup
// Verwijdert stukken uit ledendossiers waarvan de bewaartermijn is verlopen
// (member_files.expires_at, zie migratie 128). Aangeroepen door pg_cron, elk
// uur, zonder JWT (deploy met --no-verify-jwt) en met een eenmalig kaartje uit
// de database (migratie 122).
//
// Per verlopen stuk:
//   1. het bestand uit bucket member-files;
//   2. de kopie uit bucket backup-files en de regel in storage_backup_log;
//   3. de rij in member_files (document_requests.response_file_id wordt null,
//      de uitkomst van de beoordeling blijft op het verzoek staan);
//   4. een regel in audit_logs: member_file.retention_deleted.
//
// De volgorde is bewust: pas als het bestand en de back-up weg zijn verdwijnt
// de rij. Mislukt een stap, dan blijft de rij staan en pakt de volgende run
// hem opnieuw op. De functie leest of opent zelf geen bestanden.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  Deno.env.get('SB_SECRET_KEY') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SOURCE_BUCKET = 'member-files'
const BACKUP_BUCKET = 'backup-files'
const MAX_FILES = Number(Deno.env.get('RETENTION_MAX_FILES') || '200')

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

// Zie storage-backup: kaartje van de database, eenmalig en hooguit vijf
// minuten oud. Zonder geldig kaartje doen we niets.
// deno-lint-ignore no-explicit-any
async function kaartjeGeldig(sb: any, ticket: unknown, doel: string): Promise<boolean> {
  if (typeof ticket !== 'string' || !/^[0-9a-f-]{36}$/i.test(ticket)) return false
  const { data, error } = await sb.from('cron_tickets').delete()
    .eq('id', ticket).eq('doel', doel)
    .gt('created_at', new Date(Date.now() - 5 * 60_000).toISOString())
    .select('id')
  return !error && (data?.length ?? 0) === 1
}

Deno.serve(async (req) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return new Response('missing config', { status: 500 })
  let ticket: unknown = null
  try { ticket = (await req.json())?.ticket } catch { /* geen body */ }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  if (!(await kaartjeGeldig(sb, ticket, 'retention-cleanup'))) return new Response('forbidden', { status: 403 })

  const stats = { expired: 0, deleted: 0, failed: 0 }

  const { data: rows, error } = await sb
    .from('member_files')
    .select('id, file_path, category, project_id, profile_id, organization_id, request_id, expires_at, created_at')
    .lte('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .limit(MAX_FILES)
  if (error) {
    console.error('[retention-cleanup] ophalen mislukt', error.message)
    return new Response(JSON.stringify({ ok: false, error: 'ophalen mislukt' }), { status: 500 })
  }

  const projectOrg = new Map<string, string | null>()
  async function orgVan(projectId: string): Promise<string | null> {
    if (!projectOrg.has(projectId)) {
      const { data } = await sb.from('projects').select('organization_id').eq('id', projectId).maybeSingle()
      projectOrg.set(projectId, (data?.organization_id as string | undefined) ?? null)
    }
    return projectOrg.get(projectId) ?? null
  }

  for (const f of (rows ?? []) as Row[]) {
    stats.expired++
    try {
      // remove() geeft geen fout als het object al weg is; dat is hier goed.
      const { error: srcErr } = await sb.storage.from(SOURCE_BUCKET).remove([f.file_path])
      if (srcErr) throw new Error(`bron: ${srcErr.message}`)

      const { error: bakErr } = await sb.storage.from(BACKUP_BUCKET).remove([`${SOURCE_BUCKET}/${f.file_path}`])
      if (bakErr) throw new Error(`back-up: ${bakErr.message}`)

      const { error: logErr } = await sb.from('storage_backup_log').delete()
        .eq('source_bucket', SOURCE_BUCKET).eq('name', f.file_path)
      if (logErr) throw new Error(`back-uplog: ${logErr.message}`)

      const { error: rowErr } = await sb.from('member_files').delete().eq('id', f.id)
      if (rowErr) throw new Error(`rij: ${rowErr.message}`)

      const { error: auditErr } = await sb.from('audit_logs').insert({
        user_id: null,
        action: 'member_file.retention_deleted',
        resource_type: 'member_file',
        resource_id: f.id,
        project_id: f.project_id,
        organization_id: f.organization_id ?? await orgVan(f.project_id),
        metadata: {
          actor: 'retention-cleanup',
          reason: 'bewaartermijn verlopen',
          category: f.category,
          profile_id: f.profile_id,
          request_id: f.request_id,
          uploaded_at: f.created_at,
          expires_at: f.expires_at,
          storage_removed: true,
          backup_removed: true,
        },
      })
      if (auditErr) console.error('[retention-cleanup] auditregel mislukt', f.id, auditErr.message)

      stats.deleted++
    } catch (e) {
      stats.failed++
      console.error('[retention-cleanup] verwijderen mislukt', f.id, (e as Error).message)
    }
  }

  return new Response(JSON.stringify({ ok: stats.failed === 0, ...stats }), {
    status: stats.failed === 0 ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  })
})
