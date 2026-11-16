import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  emailParagraph,
  emailQuote,
  escapeHtml,
  loadProjectEmailBrand,
  renderEmailLayout,
  resolveEmailTheme,
  type EmailBrand,
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}


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

// Beheerder of moderator van een project, beheerder van een organisatie of
// platformbeheerder. Alle mails hieronder (welkom, afwijzing, uitnodigingen)
// worden door hen verstuurd; een gewoon lid of een bezoeker hoort hier niet.
async function isStaff(admin: any, userId: string): Promise<boolean> {
  if (await isPlatformAdmin(admin, userId)) return true
  const { count: orgCount } = await admin.from('org_members')
    .select('id', { count: 'exact', head: true }).eq('profile_id', userId).eq('role', 'admin')
  if ((orgCount ?? 0) > 0) return true
  const { count: modCount } = await admin.from('memberships')
    .select('id', { count: 'exact', head: true }).eq('profile_id', userId).in('role', ['admin', 'moderator'])
  return (modCount ?? 0) > 0
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, memberName, memberEmail, projectName, reason, projectUrl, projectId, personalMessage, orgName, orgUrl, inviterName, groupName, token, responseId } = await req.json()

    // Bevestigingsmail na een publieke intake-inzending. Aangeroepen vanaf het
    // anonieme intakeformulier, daarom vertrouwen we GEEN client-input voor de
    // ontvanger: we zoeken naam/e-mail/project op via responseId met de service
    // key. Zo kan dit endpoint niet misbruikt worden om naar willekeurige
    // adressen te mailen.
    if (type === 'intake_received') {
      if (!responseId) {
        return new Response(JSON.stringify({ error: 'No responseId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        console.error('[send-member-email] Missing SUPABASE_URL or SERVICE_ROLE_KEY')
        return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const { data: resp, error: respErr } = await admin
        .from('intake_responses')
        .select('name, email, projects(name, logo_url, app_accent_color, app_structure_color)')
        .eq('id', responseId)
        .single()

      if (respErr || !resp?.email) {
        console.error('[send-member-email] intake_received lookup failed:', respErr)
        return new Response(JSON.stringify({ error: 'Response not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const proj = (resp.projects as {
        name?: string; logo_url?: string | null; app_accent_color?: string | null; app_structure_color?: string | null
      } | null) || null
      const projName = proj?.name || 'het project'
      const firstName = (resp.name || '').trim().split(' ')[0]
      const greeting = firstName ? `Hoi ${firstName},` : 'Hoi,'

      const brand: EmailBrand | null = proj?.name
        ? { name: proj.name, logoUrl: proj.logo_url, accentColor: proj.app_accent_color, structureColor: proj.app_structure_color }
        : null
      const subject = `We hebben je aanmelding voor ${projName} ontvangen`
      const html = renderEmailLayout({
        subject,
        preheader: 'De initiatiefnemers nemen contact met je op. Je hoeft nu even niets te doen.',
        brand,
        heading: greeting,
        bodyHtml:
          emailParagraph(`Bedankt voor je aanmelding bij <strong>${escapeHtml(projName)}</strong>. We hebben 'm goed ontvangen.`) +
          emailParagraph('De initiatiefnemers bekijken je aanmelding en nemen daarna contact met je op. Je hoeft nu even niets te doen.'),
        footerNote: `Dit is een automatisch bericht van ${projName}. Heb je je niet aangemeld? Dan kun je deze mail negeren.`,
      }, resolveEmailTheme(brand))

      if (!RESEND_API_KEY) {
        console.log(`[send-member-email] No RESEND_API_KEY set. Would send intake_received to ${resp.email}`)
        return new Response(JSON.stringify({ success: true, dry_run: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [resp.email], subject, html }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Resend error (intake_received):', data)
        return new Response(JSON.stringify({ error: 'Email send failed', details: data }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ success: true, id: data.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Alles behalve de intakebevestiging hierboven stuurt een mail naar een
    // adres uit het verzoek. Zonder deze controle was dit een open mailrelay
    // vanaf noreply@buuur.nl voor iedereen met de openbare sleutel.
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    {
      const caller = await callerFromRequest(admin, req)
      if (!caller || !(await isStaff(admin, caller.id))) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    if (!memberEmail) {
      return new Response(JSON.stringify({ error: 'No email address' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Huisstijl van het project (logo en kleuren) als we het id kennen, anders
    // alleen de naam; zonder project het buuur-merkje.
    const projectBrand: EmailBrand | null =
      (await loadProjectEmailBrand(admin, projectId)) ?? (projectName ? { name: projectName } : null)
    const projectTheme = resolveEmailTheme(projectBrand)
    const greeting = memberName ? `Hoi ${memberName},` : 'Hoi,'
    const automatic = `Dit is een automatisch bericht${projectName ? ` van ${projectName}` : ''}.`

    let subject: string
    let html: string

    if (type === 'welcome') {
      subject = `Welkom bij ${projectName}!`
      html = renderEmailLayout({
        subject,
        preheader: `Je bent goedgekeurd als aspirant-lid van ${projectName}.`,
        brand: projectBrand,
        heading: memberName ? `Welkom, ${memberName}!` : 'Welkom!',
        bodyHtml:
          emailParagraph(`Goed nieuws: je bent goedgekeurd als aspirant-lid van <strong>${escapeHtml(projectName || '')}</strong>.`) +
          emailParagraph('Je hebt nu toegang tot de community. Neem de tijd om rond te kijken, je profiel aan te vullen en kennis te maken met de andere leden.'),
        footerNote: automatic,
      }, projectTheme)
    } else if (type === 'rejection') {
      subject = `Update over je aanvraag bij ${projectName}`
      const reasonText = typeof reason === 'string' ? reason.trim() : ''
      html = renderEmailLayout({
        subject,
        preheader: `Een update over je aanvraag bij ${projectName}.`,
        brand: projectBrand,
        heading: greeting,
        bodyHtml:
          emailParagraph(`Bedankt voor je interesse in <strong>${escapeHtml(projectName || '')}</strong>. Helaas is je aanvraag op dit moment niet goedgekeurd.`) +
          (reasonText ? emailQuote(projectTheme, null, reasonText) : '') +
          emailParagraph('Als je vragen hebt, neem dan contact op met de beheerders van het project.'),
        footerNote: automatic,
      }, projectTheme)
    } else if (type === 'invite') {
      // Geen magische link meer (1 uur geldig, eenmalig — onhandig als de mail op
      // een raar moment binnenkomt). We sturen naar de permanente projectpagina;
      // daar logt de genodigde in met e-mail + verificatiecode (opnieuw aan te
      // vragen, geen tijdslimiet). Het account wordt bij die eerste login
      // aangemaakt — handle_new_user koppelt dan de uitnodiging/intake en vult
      // naam + consent, dus de profiel-modal blijft weg.
      const loginUrl = projectUrl ? projectUrl.replace(/\/$/, '') : 'https://buuur.nl'

      // Cascade intro-tekst: project.invite_intro_text > organization > default.
      // Best-effort: lukt het lezen niet, dan de default.
      let introText: string | null = null
      if (projectId) {
        try {
          const { data: projectData } = await admin
            .from('projects')
            .select('invite_intro_text, organizations(invite_intro_text)')
            .eq('id', projectId)
            .single()
          const orgIntro = (projectData?.organizations as { invite_intro_text?: string | null } | null)?.invite_intro_text || null
          introText = projectData?.invite_intro_text || orgIntro || null
        } catch (_e) { /* val terug op default */ }
      }

      if (!introText) {
        introText = `Je bent uitgenodigd om kennis te maken met {projectnaam}.\n\nKlik op de knop hieronder, vul je e-mailadres in en je krijgt een verificatiecode om in te loggen — geen wachtwoord nodig.`
      }

      // Placeholders vervangen na het escapen: de placeholders zijn geen user
      // input, de waardes wel.
      const introEscaped = escapeHtml(introText)
        .replace(/\{naam\}/g, escapeHtml(memberName || ''))
        .replace(/\{projectnaam\}/g, `<strong>${escapeHtml(projectName || 'het project')}</strong>`)

      // Lege regels worden alinea's, enkele regeleinden <br/>.
      const introHtml = introEscaped
        .split(/\n\s*\n/)
        .map((p) => emailParagraph(p.replace(/\n/g, '<br/>')))
        .join('')

      // Optioneel persoonlijk bericht, als citaat boven de generieke intro.
      const personalHtml = personalMessage && typeof personalMessage === 'string' && personalMessage.trim()
        ? emailQuote(projectTheme, inviterName ? `Bericht van ${inviterName}` : null, personalMessage.trim())
        : ''

      subject = `Je bent uitgenodigd voor ${projectName}`
      html = renderEmailLayout({
        subject,
        preheader: `Je bent uitgenodigd voor ${projectName || 'het project'}. Inloggen gaat met een verificatiecode.`,
        brand: projectBrand,
        heading: greeting,
        bodyHtml: personalHtml + introHtml,
        button: { label: `Inloggen bij ${projectName || 'het project'}`, url: loginUrl },
        afterButtonHtml: emailParagraph(
          "Je logt in met je e-mailadres en een verificatiecode die we je toesturen — geen wachtwoord nodig. Deze link blijft geldig, dus je kunt 'm altijd opnieuw gebruiken.",
          { muted: true, small: true },
        ),
      }, projectTheme)
    } else if (type === 'org_admin_invite') {
      const redirectTo = orgUrl ? `${orgUrl.replace(/\/$/, '')}/auth/callback` : undefined
      const linkOptions = redirectTo ? { redirectTo } : undefined

      // Zie 'invite': nieuwe beheerders hebben nog geen account, dus `invite` met fallback naar `magiclink`.
      let { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'invite',
        email: memberEmail,
        options: linkOptions,
      })
      if (linkErr) {
        ;({ data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email: memberEmail,
          options: linkOptions,
        }))
      }

      if (linkErr || !linkData?.properties?.action_link) {
        console.error('generateLink error:', linkErr)
        return new Response(JSON.stringify({ error: 'Magic link generation failed', details: linkErr?.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const actionLink = linkData.properties.action_link
      const orgStrong = `<strong>${escapeHtml(orgName || '')}</strong>`
      const inviterLine = inviterName
        ? `${escapeHtml(inviterName)} heeft je uitgenodigd als beheerder van ${orgStrong}.`
        : `Je bent uitgenodigd als beheerder van ${orgStrong}.`
      const orgBrand: EmailBrand | null = orgName ? { name: orgName } : null

      subject = `Je bent uitgenodigd als beheerder van ${orgName}`
      html = renderEmailLayout({
        subject,
        preheader: `Open je uitnodiging om beheerder van ${orgName} te worden.`,
        brand: orgBrand,
        heading: greeting,
        bodyHtml:
          emailParagraph(inviterLine) +
          emailParagraph('Klik op de knop hieronder om je account aan te maken en in te loggen — geen wachtwoord nodig. Daarna ben je direct beheerder.'),
        button: { label: 'Open je uitnodiging', url: actionLink },
        afterButtonHtml: emailParagraph(
          'De link werkt eenmalig en is een uur geldig. Als je deze mail niet verwachtte kun je hem negeren.',
          { muted: true, small: true },
        ),
      }, resolveEmailTheme(orgBrand))
    } else if (type === 'added_to_workgroup') {
      const group = groupName || 'een groep'
      const link = projectUrl ? projectUrl.replace(/\/$/, '') : null
      subject = `Je bent toegevoegd aan ${group}`
      html = renderEmailLayout({
        subject,
        preheader: `Je bent toegevoegd aan de groep ${group}${projectName ? ` van ${projectName}` : ''}.`,
        brand: projectBrand,
        heading: greeting,
        bodyHtml:
          emailParagraph(`Je bent toegevoegd aan de groep <strong>${escapeHtml(group)}</strong>${projectName ? ` van <strong>${escapeHtml(projectName)}</strong>` : ''}.`) +
          emailParagraph('Berichten die binnen deze groep gedeeld worden zie je voortaan op het prikbord, en documenten die met de groep gedeeld zijn vind je bij Documenten.'),
        button: link ? { label: 'Naar de community', url: link } : null,
        footerNote: automatic,
      }, projectTheme)
    } else if (type === 'profile_intake') {
      const base = projectUrl ? projectUrl.replace(/\/$/, '') : ''
      const link = token ? `${base}/profiel-intake/${token}` : base
      const message = typeof personalMessage === 'string' ? personalMessage.trim() : ''
      subject = `Vul je gegevens aan${projectName ? ` voor ${projectName}` : ''}`
      html = renderEmailLayout({
        subject,
        preheader: 'Vul een paar gegevens aan voor je profiel.',
        brand: projectBrand,
        heading: greeting,
        bodyHtml:
          emailParagraph(`${projectName ? `<strong>${escapeHtml(projectName)}</strong>` : 'De initiatiefnemers'} vraagt je om een paar gegevens aan te vullen voor je profiel.`) +
          (message ? emailQuote(projectTheme, null, message) : ''),
        button: link ? { label: 'Vul je gegevens aan', url: link } : null,
        footerNote: automatic,
      }, projectTheme)
    } else {
      return new Response(JSON.stringify({ error: 'Unknown email type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send via Resend
    if (!RESEND_API_KEY) {
      console.log(`[send-member-email] No RESEND_API_KEY set. Would send ${type} email to ${memberEmail}`)
      return new Response(JSON.stringify({ success: true, dry_run: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [memberEmail],
        subject,
        html,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend error:', data)
      return new Response(JSON.stringify({ error: 'Email send failed', details: data }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Function error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
