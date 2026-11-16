// light-welcome-email
// Welkomstmail voor wie zelf een buuur light-groep heeft gestart. Aangeroepen
// door de app direct na create_initiative_group, met { project_id } en de JWT
// van de gebruiker (verify_jwt aan).
//
// Misbruik voorkomen (de mail gaat alleen naar het eigen adres van de aanroeper):
//   * de aanroeper moet beheerder van het project zijn;
//   * het project moet bij een light-org horen (kind = 'personal');
//   * per org hooguit één mail: organizations.welcome_sent_at wordt atomair geclaimd.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@buuur.nl'
const FROM_NAME = Deno.env.get('FROM_NAME') || 'Buuur'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY =
  (Deno.env.get('SUPABASE_SECRET_KEYS') || '').match(/sb_secret_[A-Za-z0-9_-]+/)?.[0] ||
  Deno.env.get('SB_SECRET_KEY') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const MAIN_DOMAIN = Deno.env.get('MAIN_DOMAIN') || 'buuur.nl'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function welcomeEmail(firstName: string, groupName: string, url: string, limit: number): string {
  const step = (n: number, title: string, body: string) =>
    `<tr><td style="vertical-align:top;padding:0 12px 14px 0;font-size:22px;font-style:italic;color:#4A90D9">${n}</td>` +
    `<td style="padding:0 0 14px"><strong style="font-size:15px">${title}</strong><br><span style="font-size:14px;color:#5A5F72">${body}</span></td></tr>`
  const inner = `
<h1 style="font-size:22px;margin:0 0 12px">Welkom bij buuur, ${escapeHtml(firstName)}</h1>
<p style="font-size:15px;line-height:1.55;margin:0 0 18px">${escapeHtml(groupName)} heeft nu een eigen plek. Je vindt je groep op:</p>
<p style="margin:0 0 22px"><a href="${url}" style="display:inline-block;background:#4A90D9;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:9999px">${escapeHtml(url.replace('https://', ''))}</a></p>
<p style="font-size:15px;font-weight:600;margin:0 0 12px">Zo kom je op gang</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 8px">
${step(1, 'Geef je groep een gezicht', 'Logo, kleur en een korte omschrijving onder Instellingen.')}
${step(2, 'Schrijf een eerste bericht', 'Vertel in Projectnieuws wie jullie zijn en waar je naartoe wilt.')}
${step(3, 'Haal je mensen erbij', 'Nodig ze uit via Leden, of deel het aanmeldformulier van je publieke pagina.')}
</table>
<p style="font-size:14px;line-height:1.55;color:#5A5F72;margin:14px 0 0">Inloggen gaat zonder wachtwoord: je vult je e-mailadres in en krijgt een code. buuur light is gratis tot ${limit} leden. Daarna kost het € 29 per maand of € 290 per jaar (incl. btw); dat vraag je zelf aan in je ledenlijst.</p>
<p style="font-size:14px;line-height:1.55;color:#5A5F72;margin:14px 0 0">Loop je ergens op vast? Beantwoord deze mail, dan helpen we je verder.</p>`
  return `<!doctype html><html><body style="margin:0;background:#F3F1ED;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1A1A2E"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border-radius:16px;padding:28px 26px">${inner}</div></div></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'missing config' }, 500)
  if (!RESEND_API_KEY) return json({ error: 'resend not configured' }, 500)

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData } = await admin.auth.getUser(token)
  const user = userData?.user
  if (!user?.email || user.is_anonymous) return json({ error: 'not signed in' }, 401)

  let projectId: string | undefined
  try { projectId = (await req.json())?.project_id } catch { /* leeg */ }
  if (!projectId) return json({ error: 'project_id required' }, 400)

  const { data: membership } = await admin.from('memberships')
    .select('role').eq('project_id', projectId).eq('profile_id', user.id).maybeSingle()
  if (membership?.role !== 'admin') return json({ error: 'forbidden' }, 403)

  const { data: project } = await admin.from('projects')
    .select('name, slug, organization_id').eq('id', projectId).maybeSingle()
  if (!project) return json({ error: 'not found' }, 404)

  // Claim: alleen light-orgs, en alleen als de mail nog niet is verstuurd.
  const { data: org } = await admin.from('organizations')
    .update({ welcome_sent_at: new Date().toISOString() })
    .eq('id', project.organization_id).eq('kind', 'personal').is('welcome_sent_at', null)
    .select('id, member_limit').maybeSingle()
  if (!org) return json({ ok: true, skipped: true })

  const { data: profile } = await admin.from('profiles')
    .select('first_name, full_name').eq('id', user.id).maybeSingle()
  const firstName = (profile?.first_name || profile?.full_name || '').trim().split(' ')[0] || 'initiatiefnemer'
  const url = `https://${project.slug}.${MAIN_DOMAIN}`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [user.email],
      reply_to: `hallo@${MAIN_DOMAIN}`,
      subject: `${project.name} staat klaar op buuur`,
      html: welcomeEmail(firstName, project.name, url, org.member_limit ?? 10),
    }),
  })

  if (!res.ok) {
    // Claim terugdraaien, zodat een nieuwe poging mogelijk blijft.
    await admin.from('organizations').update({ welcome_sent_at: null }).eq('id', org.id)
    return json({ ok: false, status: res.status }, 502)
  }
  return json({ ok: true })
})
