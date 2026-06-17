import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, memberName, memberEmail, projectName, reason, projectUrl, projectId, personalMessage, orgName, orgUrl, inviterName, groupName, token } = await req.json()

    if (!memberEmail) {
      return new Response(JSON.stringify({ error: 'No email address' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let subject: string
    let html: string

    if (type === 'welcome') {
      subject = `Welkom bij ${projectName}!`
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
          <h1 style="font-size: 24px; color: #1a1a2e; margin-bottom: 16px;">Welkom, ${memberName}! 🎉</h1>
          <p style="font-size: 16px; color: #4a4a6a; line-height: 1.6;">
            Goed nieuws — je bent goedgekeurd als aspirant-lid van <strong>${projectName}</strong>.
          </p>
          <p style="font-size: 16px; color: #4a4a6a; line-height: 1.6;">
            Je hebt nu toegang tot de community. Neem de tijd om rond te kijken, je profiel aan te vullen en kennis te maken met de andere leden.
          </p>
          <p style="font-size: 14px; color: #9ba1b0; margin-top: 32px;">
            Dit is een automatisch bericht van ${projectName}.
          </p>
        </div>
      `
    } else if (type === 'rejection') {
      subject = `Update over je aanvraag bij ${projectName}`
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
          <h1 style="font-size: 24px; color: #1a1a2e; margin-bottom: 16px;">Hoi ${memberName},</h1>
          <p style="font-size: 16px; color: #4a4a6a; line-height: 1.6;">
            Bedankt voor je interesse in <strong>${projectName}</strong>. Helaas is je aanvraag op dit moment niet goedgekeurd.
          </p>
          <div style="background: #f4f5f7; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
            <p style="font-size: 14px; color: #4a4a6a; margin: 0; font-style: italic;">"${reason}"</p>
          </div>
          <p style="font-size: 16px; color: #4a4a6a; line-height: 1.6;">
            Als je vragen hebt, neem dan contact op met de beheerders van het project.
          </p>
          <p style="font-size: 14px; color: #9ba1b0; margin-top: 32px;">
            Dit is een automatisch bericht van ${projectName}.
          </p>
        </div>
      `
    } else if (type === 'invite') {
      if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        console.error('[send-member-email] Missing SUPABASE_URL or SERVICE_ROLE_KEY')
        return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const redirectTo = projectUrl ? `${projectUrl.replace(/\/$/, '')}/auth/callback` : undefined
      const linkOptions = redirectTo ? { redirectTo } : undefined

      // Nieuwe genodigden hebben nog geen account: `invite` maakt de gebruiker aan én geeft een
      // action_link terug (verstuurt zelf geen mail). Bestaande accounts kun je niet opnieuw
      // uitnodigen, dus daarvoor vallen we terug op `magiclink`.
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
        return new Response(JSON.stringify({ error: 'Magic link generation failed', details: { message: linkErr?.message, status: (linkErr as { status?: number })?.status, code: (linkErr as { code?: string })?.code, name: linkErr?.name } }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const actionLink = linkData.properties.action_link
      const greeting = memberName ? `Hoi ${memberName}` : 'Hoi'

      // Cascade: project.invite_intro_text > organization.invite_intro_text > default
      let introText: string | null = null
      if (projectId) {
        const { data: projectData } = await admin
          .from('projects')
          .select('invite_intro_text, organization_id, organizations(invite_intro_text)')
          .eq('id', projectId)
          .single()

        const orgIntro = (projectData?.organizations as { invite_intro_text?: string | null } | null)?.invite_intro_text || null
        introText = projectData?.invite_intro_text || orgIntro || null
      }

      if (!introText) {
        introText = `Je bent uitgenodigd om kennis te maken met {projectnaam}.\n\nKlik op de knop hieronder om je account aan te maken en in te loggen — geen wachtwoord nodig.`
      }

      // Placeholder substitution (na escape; placeholders zijn geen user input maar de waardes wel)
      const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
      introText = escapeHtml(introText)
        .replace(/\{naam\}/g, escapeHtml(memberName || ''))
        .replace(/\{projectnaam\}/g, `<strong>${escapeHtml(projectName || 'het project')}</strong>`)

      // Render: lege regels worden paragraaf-breaks, enkele newlines worden <br>
      const introHtml = introText
        .split(/\n\s*\n/)
        .map(p => `<p style="font-size: 16px; color: #4a4a6a; line-height: 1.6;">${p.replace(/\n/g, '<br>')}</p>`)
        .join('')

      // Optioneel persoonlijk bericht (citaat-blok boven de generieke intro)
      let personalHtml = ''
      if (personalMessage && typeof personalMessage === 'string' && personalMessage.trim()) {
        const escapedMessage = escapeHtml(personalMessage.trim())
          .split(/\n\s*\n/)
          .map(p => p.replace(/\n/g, '<br>'))
          .join('</p><p style="font-size: 15px; color: #1a1a2e; margin: 8px 0 0; line-height: 1.6;">')
        personalHtml = `
          <div style="background:#f4f5f7; border-left:3px solid #4A90D9; border-radius:8px; padding:16px 20px; margin:0 0 24px;">
            <p style="font-size: 15px; color: #1a1a2e; margin: 0; line-height: 1.6;">${escapedMessage}</p>
          </div>
        `
      }

      subject = `Je bent uitgenodigd voor ${projectName}`
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
          <h1 style="font-size: 24px; color: #1a1a2e; margin-bottom: 16px;">${greeting},</h1>
          ${personalHtml}
          ${introHtml}
          <p style="margin: 28px 0;">
            <a href="${actionLink}" style="display:inline-block;background:#4A90D9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
              Open je uitnodiging
            </a>
          </p>
          <p style="font-size: 14px; color: #9ba1b0;">
            De link werkt eenmalig en is een uur geldig. Als je deze mail niet verwachtte kun je hem negeren.
          </p>
        </div>
      `
    } else if (type === 'org_admin_invite') {
      if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        console.error('[send-member-email] Missing SUPABASE_URL or SERVICE_ROLE_KEY')
        return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

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
      const greeting = memberName ? `Hoi ${memberName}` : 'Hoi'
      const inviterLine = inviterName
        ? `${inviterName} heeft je uitgenodigd als beheerder van <strong>${orgName}</strong>.`
        : `Je bent uitgenodigd als beheerder van <strong>${orgName}</strong>.`

      subject = `Je bent uitgenodigd als beheerder van ${orgName}`
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
          <h1 style="font-size: 24px; color: #1a1a2e; margin-bottom: 16px;">${greeting},</h1>
          <p style="font-size: 16px; color: #4a4a6a; line-height: 1.6;">
            ${inviterLine}
          </p>
          <p style="font-size: 16px; color: #4a4a6a; line-height: 1.6;">
            Klik op de knop hieronder om je account aan te maken en in te loggen — geen wachtwoord nodig. Daarna ben je direct beheerder.
          </p>
          <p style="margin: 28px 0;">
            <a href="${actionLink}" style="display:inline-block;background:#4A90D9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
              Open je uitnodiging
            </a>
          </p>
          <p style="font-size: 14px; color: #9ba1b0;">
            De link werkt eenmalig en is een uur geldig. Als je deze mail niet verwachtte kun je hem negeren.
          </p>
        </div>
      `
    } else if (type === 'added_to_workgroup') {
      const greeting = memberName ? `Hoi ${memberName}` : 'Hoi'
      const group = groupName || 'een groep'
      const link = projectUrl ? projectUrl.replace(/\/$/, '') : null
      subject = `Je bent toegevoegd aan ${group}`
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
          <h1 style="font-size: 24px; color: #1a1a2e; margin-bottom: 16px;">${greeting},</h1>
          <p style="font-size: 16px; color: #4a4a6a; line-height: 1.6;">
            Je bent toegevoegd aan de groep <strong>${group}</strong>${projectName ? ` van <strong>${projectName}</strong>` : ''}.
          </p>
          <p style="font-size: 16px; color: #4a4a6a; line-height: 1.6;">
            Berichten die binnen deze groep gedeeld worden zie je voortaan op het prikbord, en documenten die met de groep gedeeld zijn vind je bij Documenten.
          </p>
          ${link ? `
          <p style="margin: 28px 0;">
            <a href="${link}" style="display:inline-block;background:#4A90D9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
              Naar de community
            </a>
          </p>` : ''}
          <p style="font-size: 14px; color: #9ba1b0; margin-top: 32px;">
            Dit is een automatisch bericht${projectName ? ` van ${projectName}` : ''}.
          </p>
        </div>
      `
    } else if (type === 'profile_intake') {
      const greeting = memberName ? `Hoi ${memberName}` : 'Hoi'
      const base = projectUrl ? projectUrl.replace(/\/$/, '') : ''
      const link = token ? `${base}/profiel-intake/${token}` : base
      subject = `Vul je gegevens aan${projectName ? ` voor ${projectName}` : ''}`
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
          <h1 style="font-size: 24px; color: #1a1a2e; margin-bottom: 16px;">${greeting},</h1>
          <p style="font-size: 16px; color: #4a4a6a; line-height: 1.6;">
            ${projectName ? `<strong>${projectName}</strong>` : 'De initiatiefnemers'} ${personalMessage ? '' : 'vraagt je om een paar gegevens aan te vullen voor je profiel.'}
          </p>
          ${personalMessage ? `
          <div style="background: #f4f5f7; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
            <p style="font-size: 15px; color: #4a4a6a; margin: 0; line-height: 1.5;">${personalMessage}</p>
          </div>` : ''}
          <p style="margin: 28px 0;">
            <a href="${link}" style="display:inline-block;background:#4A90D9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
              Vul je gegevens aan
            </a>
          </p>
          <p style="font-size: 14px; color: #9ba1b0; margin-top: 32px;">
            Dit is een automatisch bericht${projectName ? ` van ${projectName}` : ''}.
          </p>
        </div>
      `
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
