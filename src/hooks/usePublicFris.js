import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getProjectSlugFromSubdomain } from '../lib/subdomain'
import { accentVars } from '../lib/brandAccent'
import { loadFonts } from '../lib/fonts'

// Het blauw van Fris: de terugval als een project geen eigen steunkleur heeft.
const FRIS_BLUE = '#2341FF'

// Losse namen op <html> voor wat buiten het scherm zelf valt (de cookiemelding).
const ROOT_VARS = {
  '--public-cta': '--accent-cta',
  '--public-on-cta': '--accent-on-cta',
  '--public-text': '--accent-primary',
}

/**
 * Fris-look voor schermen vóór het inloggen (inloggen, code invullen, verlopen
 * link). Die draaien buiten het projectthema, dus er is geen ThemeProvider die
 * de look of de steunkleur van het project zet.
 *
 * Geeft de projectgegevens terug (op een projectsubdomein) en de props voor het
 * buitenste element van het scherm. Dat element draagt zelf data-look en
 * data-theme, zodat de Fris-tokens daar gelden zonder iets aan <html> te
 * veranderen. De steunkleur staat er inline op: een token als --accent-cta is
 * op <html> al uitgerekend naar het oude blauw en zou anders zo doorerven.
 *
 * Altijd licht. Projecten in de CrowdBuilding-stijl houden het oude uiterlijk:
 * Fris en dat thema gaan nooit samen.
 */
export function usePublicFris() {
  const [project, setProject] = useState(null)

  useEffect(() => {
    loadFonts(['Instrument Serif'])
    const slug = getProjectSlugFromSubdomain()
    if (!slug) return
    supabase
      .from('projects')
      .select('name, logo_url, tagline, app_accent_color, app_structure_color, default_theme, organization:organizations(default_theme)')
      .eq('slug', slug)
      .single()
      .then(({ data }) => { if (data) setProject(data) })
  }, [])

  const crowdbuilding = (project?.default_theme || project?.organization?.default_theme) === 'crowdbuilding'
  const accent = project?.app_accent_color
  const structure = project?.app_structure_color
  const vars = accentVars(
    { accent: accent || structure || FRIS_BLUE, structure: structure || accent || FRIS_BLUE },
    false,
  )
  const cta = vars['--accent-cta']
  const text = vars['--accent-primary']

  useEffect(() => {
    if (crowdbuilding) return
    const root = document.documentElement
    Object.entries(ROOT_VARS).forEach(([name, from]) => root.style.setProperty(name, vars[from]))
    return () => Object.keys(ROOT_VARS).forEach((name) => root.style.removeProperty(name))
  }, [crowdbuilding, cta, text])

  const pageProps = crowdbuilding ? {} : { 'data-look': 'fris', 'data-theme': 'warm', style: vars }
  return { project, pageProps }
}
