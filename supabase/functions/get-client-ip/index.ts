// get-client-ip
// Triviale edge function die het IP-adres van de aanroepende client terugleest
// uit de request-headers. Gebruikt door de tekenflow om signed_ip in zowel de
// audit-pagina (PDF) als de signature_request_signers rij vast te leggen.
//
// Waarom een edge function en geen ipify.org call? De CSP van de community-app
// staat alleen Supabase/Sentry/CrowdBuilding-hosts toe — externe IP-services
// zijn geblokt. Supabase edge functions zitten op *.supabase.co dus die wél.
//
// JWT-verified: alleen ingelogde gebruikers kunnen aanroepen.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Bij Supabase/Vercel/Cloudflare-proxies zit het echte client-IP in een van
  // deze headers. We pakken de eerste hit; bij x-forwarded-for is dat de
  // oorspronkelijke client (de keten staat als 'client, proxy1, proxy2').
  const xff = req.headers.get('x-forwarded-for')
  const ip = (xff ? xff.split(',')[0]?.trim() : null)
    || req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || null

  return new Response(JSON.stringify({ ip }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
