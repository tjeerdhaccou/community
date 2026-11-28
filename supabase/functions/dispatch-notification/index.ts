// dispatch-notification
// Centrale edge function voor alle activity notifications (in-app + email).
//
// Roep aan met:
//   { project_id, type, reference_id, actor_id }
//
// Types:
//   - new_update       → alle members met juiste audience-toegang
//   - new_event        → alle members met juiste visibility-toegang
//   - new_document     → alle members (guest+)
//   - new_post         → alle members met juiste audience-toegang
//   - new_comment      → alle followers van de post (incl. auteur post)
//   - new_reply        → de auteur van de comment waarop gereageerd wordt
//   - new_update_comment → auteur van update + andere commenters
//
// Skiplogica:
//   - actor_id zelf (geen mail naar jezelf)
//   - pref_<type> = 'mute'
//   - mute_until > now()
//   - geen notification_preferences rij → opt-in, dus skip email (wel in-app)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  renderEmailLayout,
  resolveEmailTheme,
  emailParagraph,
  emailQuote,
  emailFooterLink,
  escapeHtml,
  type EmailBrand,
  type EmailTheme,
} from '../_shared/email-layout.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@buuur.nl'
const FROM_NAME = Deno.env.get('FROM_NAME') || 'Buuur'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
// Use a new secret key (sb_secret_…), preferring Supabase's auto-managed SUPABASE_SECRET_KEYS,
// then an explicit SB_SECRET_KEY (only if it's actually a secret key), and finally the legacy service_role.
const _explicitSecret = Deno.env.get('SB_SECRET_KEY') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  (_explicitSecret.startsWith('sb_secret_') ? _explicitSecret : '') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const UNSUBSCRIBE_SECRET = Deno.env.get('UNSUBSCRIBE_SECRET') || ''
const MAIN_DOMAIN = Deno.env.get('MAIN_DOMAIN') || 'buuur.nl'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Pref = 'all' | 'mentions' | 'mute'
type Type =
  | 'new_update'
  | 'new_event'
  | 'new_document'
  | 'new_post'
  | 'new_comment'
  | 'new_reply'
  | 'new_update_comment'
  | 'document_request'
  | 'document_request_submitted'
  | 'signature_request'

// Mapping van notificatie-type naar preference-kolom
const PREF_COLUMN: Record<Type, 'pref_updates' | 'pref_prikbord' | 'pref_events' | 'pref_documents'> = {
  new_update: 'pref_updates',
  new_event: 'pref_events',
  new_document: 'pref_documents',
  new_post: 'pref_prikbord',
  new_comment: 'pref_prikbord',
  new_reply: 'pref_prikbord',
  new_update_comment: 'pref_updates',
  document_request: 'pref_documents',
  document_request_submitted: 'pref_documents',
  signature_request: 'pref_documents',
}

// Types die alleen in-app getoond worden (geen e-mail).
// document_request_submitted: admins zien dit als bolletje/melding in het CMS,
// niet als mail bij elke upload.
const IN_APP_ONLY: Set<Type> = new Set(['document_request_submitted'])

// Persoonlijk gerichte verzoeken: de ontvanger is met naam en toenaam
// aangewezen (ondertekenaar, aangeschreven lid). Die mailen we ook bij
// voorkeur 'mentions' — het ís een persoonlijke aanspreking — en ook als de
// aanmaker toevallig zelf ontvanger is (bv. een beheerder die zichzelf een
// tekenverzoek stuurt om het te testen). Alleen 'mute' of vakantiemodus
// houdt de mail tegen.
const DIRECT_TYPES: Set<Type> = new Set(['signature_request', 'document_request'])


// ── Wie roept aan? ────────────────────────────────────────────────────────
// verify_jwt laat ook de openbare anon-sleutel en anonieme demosessies door, en
// deze functie werkt met de service-sleutel. De controle hieronder is dus de
// enige rem: zonder echte, ingelogde gebruiker met de juiste rol doen we niets.
async function callerFromRequest(admin: any, req: Request): Promise<{ id: string } | null> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return null
  try {
    const { data } = await admin.auth.getUser(jwt)
    const user = data?.user
    if (!user || user.is_anonymous) return null
    return { id: user.id }
  } catch {
    return null
  }
}

async function isPlatformAdmin(admin: any, userId: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('is_platform_admin').eq('id', userId).maybeSingle()
  return data?.is_platform_admin === true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { project_id, type, reference_id, actor_id } = await req.json()

    if (!project_id || !type || !reference_id) {
      return json({ error: 'Missing project_id, type or reference_id' }, 400)
    }
    if (!PREF_COLUMN[type as Type]) {
      return json({ error: `Unknown type: ${type}` }, 400)
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error('[dispatch] Missing SUPABASE_URL or SERVICE_ROLE_KEY')
      return json({ error: 'Server misconfigured' }, 500)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Alleen iemand die bij dit project hoort mag de leden ervan een melding
    // sturen: een lid, een beheerder van de organisatie of een platformbeheerder.
    // Zonder deze controle kon iedereen met de openbare sleutel (of een lid van
    // een ander project) alle leden van een willekeurig project mailen.
    {
      const caller = await callerFromRequest(admin, req)
      if (!caller) return json({ error: 'Forbidden' }, 403)
      let allowed = await isPlatformAdmin(admin, caller.id)
      if (!allowed) {
        const { count } = await admin.from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', project_id).eq('profile_id', caller.id)
        allowed = (count ?? 0) > 0
      }
      if (!allowed) {
        const { data: proj } = await admin.from('projects').select('organization_id').eq('id', project_id).maybeSingle()
        if (proj?.organization_id) {
          const { data: om } = await admin.from('org_members')
            .select('role, project_ids').eq('organization_id', proj.organization_id).eq('profile_id', caller.id).maybeSingle()
          allowed = om?.role === 'admin' && (om.project_ids == null || (om.project_ids as string[]).includes(project_id))
        }
      }
      if (!allowed) return json({ error: 'Forbidden' }, 403)
    }

    // Haal project + activity context op
    const ctx = await loadContext(admin, type as Type, project_id, reference_id, actor_id)
    if (!ctx) return json({ error: 'Activity not found' }, 404)

    // Bepaal ontvangers
    const recipientIds = await resolveRecipients(admin, type as Type, ctx, reference_id)

    // Skip actor zelf — behalve bij persoonlijk gerichte verzoeken, daar is
    // de ontvangerslijst expliciet.
    const isDirect = DIRECT_TYPES.has(type as Type)
    const filtered = isDirect ? recipientIds : recipientIds.filter(id => id !== actor_id)

    if (filtered.length === 0) {
      return json({ success: true, sent: 0, skipped: 0, reason: 'no_recipients' })
    }

    // Haal preferences + email + naam op
    const prefCol = PREF_COLUMN[type as Type]
    const { data: profiles, error: profErr } = await admin
      .from('profiles')
      .select(`id, full_name, email, notification_preferences(${prefCol}, mute_until, notifications_onboarded_at:profile_id)`)
      .in('id', filtered)

    if (profErr) {
      console.error('[dispatch] profiles fetch error', profErr)
      return json({ error: 'Failed to fetch recipients' }, 500)
    }

    // De join hierboven werkt soms niet als verwacht — doe een separate query als fallback
    const { data: prefs } = await admin
      .from('notification_preferences')
      .select('profile_id, pref_updates, pref_prikbord, pref_events, pref_documents, mute_until')
      .in('profile_id', filtered)

    const prefsByUser = new Map<string, any>()
    for (const p of prefs || []) prefsByUser.set(p.profile_id, p)

    const now = Date.now()

    // Splits ontvangers in: in-app (altijd), email (alleen als pref = 'all' en niet muted)
    const inAppRecipients: Array<{ id: string }> = []
    const emailRecipients: Array<{ id: string; email: string; full_name: string | null }> = []

    for (const profile of profiles || []) {
      const pref = prefsByUser.get(profile.id)
      // Default 'all' (opt-out): iedereen krijgt mail tenzij ze 'm uitschakelen
      const prefValue: Pref = pref?.[prefCol] ?? 'all'
      const muted = pref?.mute_until && new Date(pref.mute_until).getTime() > now

      // In-app: altijd tonen, tenzij expliciet gemute of vakantiemodus
      if (prefValue !== 'mute' && !muted) {
        inAppRecipients.push({ id: profile.id })
      }

      // Email: bij 'all' (default), niet muted, email aanwezig, en geen in-app-only type.
      // Persoonlijk gerichte verzoeken ook bij 'mentions'.
      const wantsMail = prefValue === 'all' || (isDirect && prefValue === 'mentions')
      if (wantsMail && !muted && profile.email && !IN_APP_ONLY.has(type as Type)) {
        emailRecipients.push({ id: profile.id, email: profile.email, full_name: profile.full_name })
      }
    }

    // 1. In-app notifications (batch insert)
    const inAppRows = inAppRecipients.map(r => ({
      recipient_id: r.id,
      actor_id,
      type,
      title: ctx.inAppTitle,
      body: ctx.inAppBody,
      related_type: ctx.relatedType,
      related_id: reference_id,
      is_read: false,
    }))

    if (inAppRows.length > 0) {
      const { error: notifErr } = await admin.from('notifications').insert(inAppRows)
      if (notifErr) console.error('[dispatch] in-app insert error', notifErr)
    }

    // 2. Emails via Resend
    let emailsSent = 0
    let emailsFailed = 0

    if (RESEND_API_KEY && emailRecipients.length > 0) {
      // Resend batch endpoint: max 100 emails per call
      const chunks = chunk(emailRecipients, 100)
      // Huisstijl van het project: één keer per dispatch, niet per ontvanger.
      const brand: EmailBrand = {
        name: ctx.project.name,
        logoUrl: ctx.project.logo_url,
        accentColor: ctx.project.app_accent_color,
        structureColor: ctx.project.app_structure_color,
      }
      const theme = resolveEmailTheme(brand)
      const prefCol = PREF_COLUMN[type as Type]
      for (const batch of chunks) {
        // Genereer per recipient een signed unsubscribe-token (async)
        const tokensPerRecipient = await Promise.all(
          batch.map(r => signUnsubscribeToken(r.id, prefCol))
        )
        const emails = batch.map((r, idx) => ({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [r.email],
          subject: ctx.emailSubject,
          html: renderEmail({
            type: type as Type,
            recipientName: r.full_name,
            recipientId: r.id,
            ctx,
            unsubToken: tokensPerRecipient[idx],
            brand,
            theme,
          }),
        }))

        const res = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emails),
        })

        const result = await res.json()
        const logRows: any[] = []

        if (res.ok && Array.isArray(result.data)) {
          // Resend returns { data: [{ id }, ...] } in same order
          for (let i = 0; i < batch.length; i++) {
            const r = batch[i]
            const sent = !!result.data[i]?.id
            logRows.push({
              user_id: r.id,
              project_id,
              notification_type: type,
              reference_id,
              channel: 'email',
              email: r.email,
              resend_message_id: result.data[i]?.id ?? null,
              status: sent ? 'sent' : 'failed',
            })
            if (sent) emailsSent++
            else emailsFailed++
          }
        } else {
          console.error('[dispatch] Resend batch error', result)
          for (const r of batch) {
            logRows.push({
              user_id: r.id,
              project_id,
              notification_type: type,
              reference_id,
              channel: 'email',
              email: r.email,
              status: 'failed',
              error_message: JSON.stringify(result).slice(0, 500),
            })
            emailsFailed++
          }
        }

        if (logRows.length > 0) {
          await admin.from('notification_log').insert(logRows)
        }
      }
    } else if (!RESEND_API_KEY && emailRecipients.length > 0) {
      console.log(`[dispatch] No RESEND_API_KEY. Would email ${emailRecipients.length} for ${type}`)
    }

    return json({
      success: true,
      in_app: inAppRows.length,
      emails_sent: emailsSent,
      emails_failed: emailsFailed,
      eligible_for_email: emailRecipients.length,
    })
  } catch (err) {
    console.error('[dispatch] Function error', err)
    return json({ error: (err as Error).message }, 500)
  }
})

// ============================================================
// Helpers
// ============================================================

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function truncate(s: string, len: number): string {
  if (!s) return ''
  return s.length > len ? s.slice(0, len) + '…' : s
}

function projectBaseUrl(project: { slug: string; custom_domain: string | null }): string {
  if (project.custom_domain) return `https://${project.custom_domain}`
  return `https://${project.slug}.${MAIN_DOMAIN}`
}

// Signed unsubscribe token: base64url(payload).base64url(signature)
// Payload: { uid, t, exp }
async function signUnsubscribeToken(userId: string, prefCol: string): Promise<string> {
  if (!UNSUBSCRIBE_SECRET) return ''
  const payload = {
    uid: userId,
    t: prefCol, // pref_updates / pref_prikbord / pref_events / pref_documents
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
  }
  const payloadStr = JSON.stringify(payload)
  const payloadB64 = b64url(new TextEncoder().encode(payloadStr))

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(UNSUBSCRIBE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadStr))
  const sigB64 = b64url(new Uint8Array(sig))

  return `${payloadB64}.${sigB64}`
}

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

// ============================================================
// Context loaders per type
// ============================================================

interface NotificationContext {
  project: {
    id: string
    name: string
    slug: string
    custom_domain: string | null
    logo_url: string | null
    app_accent_color: string | null
    app_structure_color: string | null
  }
  actorName: string | null
  emailSubject: string
  emailIntro: string // korte intro-zin onder de begroeting, bv. "Er is een nieuwe update geplaatst in X."
  emailHeading: string
  emailBody: string // korte preview, platte tekst (wordt bij renderen ge-escaped)
  emailLinkPath: string // bv. /updates#123
  inAppTitle: string
  inAppBody: string | null
  relatedType: 'update' | 'event' | 'document' | 'post' | 'comment' | 'document_request' | 'signature_request'
}

async function loadContext(
  admin: any,
  type: Type,
  projectId: string,
  referenceId: string,
  actorId: string | null,
): Promise<NotificationContext | null> {
  // Project + actor altijd nodig
  const { data: project } = await admin
    .from('projects')
    .select('id, name, slug, custom_domain, logo_url, app_accent_color, app_structure_color')
    .eq('id', projectId)
    .single()
  if (!project) return null

  let actorName: string | null = null
  if (actorId) {
    const { data: actor } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', actorId)
      .single()
    actorName = actor?.full_name ?? null
  }
  const actor = actorName || 'Iemand'

  if (type === 'new_update') {
    const { data: u } = await admin
      .from('updates')
      .select('title, body, tag, is_public')
      .eq('id', referenceId)
      .single()
    if (!u) return null
    return {
      project, actorName,
      emailSubject: `Nieuwe update in ${project.name}: ${u.title}`,
      emailIntro: `Er is een nieuwe update geplaatst in ${project.name}.`,
      emailHeading: u.title,
      emailBody: truncate(stripMd(u.body || ''), 200),
      emailLinkPath: '/updates',
      inAppTitle: `${actor} plaatste een update`,
      inAppBody: u.title,
      relatedType: 'update',
    }
  }

  if (type === 'new_event') {
    const { data: e } = await admin
      .from('meetings')
      .select('title, description, date, location, visibility')
      .eq('id', referenceId)
      .single()
    if (!e) return null
    const when = formatNlDate(e.date)
    return {
      project, actorName,
      emailSubject: `Nieuw event in ${project.name}: ${e.title}`,
      emailIntro: `Er is een nieuw event aangemaakt in ${project.name}.`,
      emailHeading: e.title,
      emailBody: `${when}${e.location ? ' · ' + e.location : ''}${e.description ? '\n\n' + truncate(e.description, 180) : ''}`,
      emailLinkPath: '/events',
      inAppTitle: `Nieuw event: ${e.title}`,
      inAppBody: when,
      relatedType: 'event',
    }
  }

  if (type === 'new_document') {
    const { data: d } = await admin
      .from('documents')
      .select('title, description, category')
      .eq('id', referenceId)
      .single()
    if (!d) return null
    return {
      project, actorName,
      emailSubject: `Nieuw document in ${project.name}: ${d.title}`,
      emailIntro: `Er is een nieuw document toegevoegd aan ${project.name}.`,
      emailHeading: d.title,
      emailBody: d.description ? truncate(d.description, 200) : 'Een nieuw document is toegevoegd.',
      emailLinkPath: '/documenten',
      inAppTitle: `${actor} voegde een document toe`,
      inAppBody: d.title,
      relatedType: 'document',
    }
  }

  if (type === 'new_post') {
    const { data: p } = await admin
      .from('posts')
      .select('text, audience')
      .eq('id', referenceId)
      .single()
    if (!p) return null
    return {
      project, actorName,
      emailSubject: `Nieuw prikbord-bericht in ${project.name}`,
      emailIntro: `Er is een nieuw bericht op het prikbord van ${project.name}.`,
      emailHeading: `${actor} plaatste iets op het prikbord`,
      emailBody: truncate(p.text || '', 220),
      emailLinkPath: '/community',
      inAppTitle: `${actor} plaatste een bericht`,
      inAppBody: truncate(p.text || '', 100),
      relatedType: 'post',
    }
  }

  if (type === 'new_comment' || type === 'new_reply') {
    // reference_id = comment.id
    const { data: c } = await admin
      .from('comments')
      .select('text, post_id, reply_to_id, post:posts(text)')
      .eq('id', referenceId)
      .single()
    if (!c) return null
    return {
      project, actorName,
      emailSubject: type === 'new_reply'
        ? `${actor} reageerde op je reactie`
        : `${actor} reageerde op een prikbord-bericht`,
      emailIntro: type === 'new_reply'
        ? `${actor} reageerde op jouw reactie in ${project.name}.`
        : `${actor} reageerde op een prikbord-bericht in ${project.name}.`,
      emailHeading: type === 'new_reply'
        ? `${actor} reageerde op jouw reactie`
        : `${actor} reageerde op het prikbord`,
      emailBody: truncate(c.text || '', 220),
      emailLinkPath: '/community',
      inAppTitle: type === 'new_reply'
        ? `${actor} reageerde op je reactie`
        : `${actor} reageerde op een bericht`,
      inAppBody: truncate(c.text || '', 100),
      relatedType: 'comment',
    }
  }

  if (type === 'new_update_comment') {
    // reference_id = update_comment.id
    const { data: c } = await admin
      .from('update_comments')
      .select('text, update_id, reply_to_id, update:updates(title)')
      .eq('id', referenceId)
      .single()
    if (!c) return null
    return {
      project, actorName,
      emailSubject: `${actor} reageerde op update "${c.update?.title || ''}"`,
      emailIntro: `${actor} reageerde op een update in ${project.name}.`,
      emailHeading: `${actor} reageerde op een update`,
      emailBody: truncate(c.text || '', 220),
      emailLinkPath: '/updates',
      inAppTitle: `${actor} reageerde op een update`,
      inAppBody: truncate(c.text || '', 100),
      relatedType: 'update',
    }
  }

  if (type === 'document_request') {
    const { data: dr } = await admin
      .from('document_requests')
      .select('title, description, type, deadline')
      .eq('id', referenceId)
      .single()
    if (!dr) return null
    const deadline = dr.deadline ? formatNlDate(dr.deadline) : null
    // Identiteitscontrole: er wordt niets geüpload, dus ook niet om gevraagd.
    if (dr.type === 'identity_check') {
      return {
        project, actorName,
        emailSubject: `Identiteitscontrole voor ${project.name}`,
        emailIntro: `Het team van ${project.name} wil je identiteitsbewijs controleren.`,
        emailHeading: dr.title,
        emailBody: 'Je hoeft niets te uploaden of op te sturen. Een beoordelaar van het project maakt een afspraak met je, in een videogesprek of op locatie, en bekijkt daar je identiteitsbewijs. Buuur bewaart alleen de uitkomst van de controle, geen kopie.' + (deadline ? `\n\nGraag voor: ${deadline}` : ''),
        emailLinkPath: '/mijn-documenten',
        inAppTitle: `Identiteitscontrole: ${dr.title}`,
        inAppBody: 'Je hoeft niets te uploaden. Een beoordelaar neemt contact met je op.',
        relatedType: 'document_request',
      }
    }
    return {
      project, actorName,
      emailSubject: `Documentverzoek in ${project.name}: ${dr.title}`,
      emailIntro: `Het team van ${project.name} heeft een documentverzoek voor je aangemaakt.`,
      emailHeading: dr.title,
      emailBody: (dr.description ? truncate(dr.description, 200) : 'Er is een document van je gevraagd.') + (deadline ? `\n\nDeadline: ${deadline}` : ''),
      emailLinkPath: '/mijn-documenten',
      inAppTitle: `Nieuw documentverzoek: ${dr.title}`,
      inAppBody: dr.description ? truncate(dr.description, 100) : null,
      relatedType: 'document_request',
    }
  }

  if (type === 'document_request_submitted') {
    const { data: dr } = await admin
      .from('document_requests')
      .select('title, profile_id, profile:profiles!document_requests_profile_id_fkey(full_name)')
      .eq('id', referenceId)
      .single()
    if (!dr) return null
    const memberName = dr.profile?.full_name || 'Een lid'
    return {
      project, actorName: memberName,
      emailSubject: `${memberName} heeft gereageerd op documentverzoek "${dr.title}"`,
      emailIntro: `${memberName} heeft een document ingediend voor "${dr.title}" in ${project.name}.`,
      emailHeading: `Documentverzoek beantwoord`,
      emailBody: `${memberName} heeft een bestand geüpload voor "${dr.title}". Controleer en keur het goed of wijs het af.`,
      emailLinkPath: '/members',
      inAppTitle: `${memberName} heeft een document ingediend`,
      inAppBody: dr.title,
      relatedType: 'document_request',
    }
  }

  if (type === 'signature_request') {
    const { data: sr } = await admin
      .from('signature_requests')
      .select('title, description, due_at')
      .eq('id', referenceId)
      .single()
    if (!sr) return null
    const deadline = sr.due_at ? formatNlDate(sr.due_at) : null
    return {
      project, actorName,
      emailSubject: `Tekenverzoek in ${project.name}: ${sr.title}`,
      emailIntro: `Het team van ${project.name} heeft je gevraagd om een document te ondertekenen.`,
      emailHeading: sr.title,
      emailBody:
        (sr.description ? truncate(sr.description, 200) : 'Open het verzoek om de overeenkomst te bekijken en te ondertekenen.')
        + (deadline ? `\n\nReageer voor: ${deadline}` : ''),
      // emailLinkPath wijst naar /mijn-documenten — de lijst met openstaande
      // tekenverzoeken. Vanaf daar gaat de lid naar /tekenen/<signer_id>.
      emailLinkPath: '/mijn-documenten',
      inAppTitle: `Nieuw tekenverzoek: ${sr.title}`,
      inAppBody: sr.description ? truncate(sr.description, 100) : null,
      relatedType: 'signature_request',
    }
  }

  return null
}

// ============================================================
// Recipient resolvers per type
// ============================================================

async function resolveRecipients(
  admin: any,
  type: Type,
  ctx: NotificationContext,
  refId: string,
): Promise<string[]> {
  const projectId = ctx.project.id

  if (type === 'new_update') {
    return await memberIds(admin, projectId, 'guest')
  }

  if (type === 'new_event') {
    return await memberIds(admin, projectId, 'guest')
  }

  if (type === 'new_document') {
    // Alleen wie het document mag lezen: de map (en een strengere submap)
    // bepaalt dat, zie migratie 129 (document_reader_ids).
    const { data, error } = await admin.rpc('document_reader_ids', { p_document_id: refId })
    if (error) {
      console.error('[dispatch] document_reader_ids error', error)
      return []
    }
    return (data || []).map((r: any) => (typeof r === 'string' ? r : r.document_reader_ids))
  }

  if (type === 'new_post') {
    return await memberIds(admin, projectId, 'aspirant')
  }

  if (type === 'new_comment') {
    // Alle followers van de post (post_follows). refId = comment.id
    const { data: comment } = await admin
      .from('comments')
      .select('post_id')
      .eq('id', refId)
      .single()
    if (!comment) return []

    const { data: follows } = await admin
      .from('post_follows')
      .select('profile_id')
      .eq('post_id', comment.post_id)
    return (follows || []).map((f: any) => f.profile_id)
  }

  if (type === 'new_reply') {
    // Alleen de auteur van de oorspronkelijke comment. refId = comment.id (de reply)
    const { data: comment } = await admin
      .from('comments')
      .select('reply_to_id')
      .eq('id', refId)
      .single()
    if (!comment?.reply_to_id) return []

    const { data: original } = await admin
      .from('comments')
      .select('author_id')
      .eq('id', comment.reply_to_id)
      .single()
    return original?.author_id ? [original.author_id] : []
  }

  if (type === 'new_update_comment') {
    // Auteur van update + andere commenters op deze update. refId = update_comment.id
    const { data: c } = await admin
      .from('update_comments')
      .select('update_id, update:updates(author_id)')
      .eq('id', refId)
      .single()
    if (!c) return []
    const ids = new Set<string>()
    if (c.update?.author_id) ids.add(c.update.author_id)
    const { data: others } = await admin
      .from('update_comments')
      .select('author_id')
      .eq('update_id', c.update_id)
    for (const o of others || []) ids.add(o.author_id)
    return [...ids]
  }

  if (type === 'document_request') {
    const { data: dr } = await admin
      .from('document_requests')
      .select('profile_id')
      .eq('id', refId)
      .single()
    return dr?.profile_id ? [dr.profile_id] : []
  }

  if (type === 'document_request_submitted') {
    const staff = await memberIds(admin, projectId, 'moderator')
    // Gevoelige verzoeken (financieel, identiteit) zijn alleen zichtbaar voor
    // de beoordelaars van het project; alleen zij krijgen dan de melding.
    const { data: dr } = await admin
      .from('document_requests')
      .select('category, type')
      .eq('id', refId)
      .single()
    if (dr && (dr.category === 'financieel' || dr.category === 'identiteit' || dr.type === 'identity_check')) {
      const { data: reviewers } = await admin
        .from('project_reviewers')
        .select('profile_id')
        .eq('project_id', projectId)
      const allowed = new Set((reviewers || []).map((r: any) => r.profile_id))
      return staff.filter((id) => allowed.has(id))
    }
    return staff
  }

  if (type === 'signature_request') {
    // Alle signers van dit verzoek krijgen een notificatie. Alleen pending/viewed
    // — wie al getekend of geweigerd heeft, niet opnieuw lastigvallen.
    const { data: signers } = await admin
      .from('signature_request_signers')
      .select('profile_id, status')
      .eq('request_id', refId)
    return (signers || [])
      .filter((s: any) => s.status === 'pending' || s.status === 'viewed')
      .map((s: any) => s.profile_id)
  }

  return []
}

const ROLE_LEVELS: Record<string, number> = {
  interested: -1, guest: 0, professional: 1, aspirant: 2,
  member: 3, moderator: 4, admin: 5,
}

async function memberIds(admin: any, projectId: string, minRole: string): Promise<string[]> {
  const min = ROLE_LEVELS[minRole] ?? 0
  const { data, error } = await admin
    .from('memberships')
    .select('profile_id, role')
    .eq('project_id', projectId)
  if (error) {
    console.error('[dispatch] memberships query error', error)
    return []
  }
  return (data || [])
    .filter((m: any) => (ROLE_LEVELS[m.role] ?? -2) >= min)
    .map((m: any) => m.profile_id)
}

// ============================================================
// Email rendering
// ============================================================

function renderEmail(args: {
  type: Type
  recipientName: string | null
  recipientId: string
  ctx: NotificationContext
  unsubToken: string
  brand: EmailBrand
  theme: EmailTheme
}): string {
  const { ctx, recipientName, unsubToken, brand, theme } = args
  const baseUrl = projectBaseUrl(ctx.project)
  const linkUrl = `${baseUrl}${ctx.emailLinkPath}`
  const firstName = recipientName?.trim().split(' ')[0]
  const greeting = firstName ? `Hoi ${escapeHtml(firstName)},` : 'Hoi,'
  // Settings altijd op main domain: localStorage-sessie is per-subdomain,
  // dus de gebruiker is op het main domain vaker al ingelogd dan op een
  // project-subdomain. Voorkomt onnodige re-login flow vanuit mail-links.
  const settingsUrl = `https://${MAIN_DOMAIN}/profile#notif-section`
  const unsubUrl = unsubToken
    ? `https://${MAIN_DOMAIN}/unsubscribe?token=${encodeURIComponent(unsubToken)}`
    : settingsUrl

  const bodyHtml = [
    emailParagraph(greeting),
    ctx.emailIntro ? emailParagraph(escapeHtml(ctx.emailIntro)) : '',
    ctx.emailBody ? emailQuote(theme, null, ctx.emailBody) : '',
  ].join('\n')

  return renderEmailLayout(
    {
      subject: ctx.emailSubject,
      preheader: ctx.emailIntro || ctx.emailHeading,
      brand,
      heading: ctx.emailHeading,
      bodyHtml,
      button: { label: `Bekijk in ${ctx.project.name}`, url: linkUrl },
      footerNote: `Je ontvangt deze mail omdat je lid bent van ${ctx.project.name} op buuur.`,
      footerHtml: [
        emailFooterLink(settingsUrl, 'Beheer je notificaties'),
        emailFooterLink(unsubUrl, 'Uitschrijven van dit type'),
      ].join(' · '),
    },
    theme,
  )
}

// ============================================================
// Small utils
// ============================================================

function stripMd(s: string): string {
  // Minimaal: weghalen van markdown syntax voor preview
  return s
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[#*_`>]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function formatNlDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
