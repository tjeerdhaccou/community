import { useAuth } from '../../contexts/AuthContext'

const PUBLIC_DOCS = [
  {
    title: 'Privacyverklaring',
    description: 'Hoe wij omgaan met persoonsgegevens van gebruikers van het platform.',
    icon: 'fa-solid fa-shield-halved',
    href: '/privacy',
  },
  {
    title: 'Algemene Voorwaarden',
    description: 'De voorwaarden die gelden bij het gebruik van het Buuur platform.',
    icon: 'fa-solid fa-file-contract',
    href: '/voorwaarden',
  },
]

const INTERNAL_DOCS = [
  {
    title: 'Verwerkersovereenkomst',
    description: 'Template verwerkersovereenkomst (Art. 28 AVG) voor organisaties die het platform gebruiken.',
    icon: 'fa-solid fa-handshake',
    href: '/legal/verwerkersovereenkomst',
  },
  {
    title: 'Datalekprotocol',
    description: 'Interne procedure voor het detecteren, beoordelen en melden van datalekken.',
    icon: 'fa-solid fa-triangle-exclamation',
    href: '/legal/datalekprotocol',
  },
  {
    title: 'Verwerkingsregister',
    description: 'Register van alle verwerkingsactiviteiten conform artikel 30 AVG.',
    icon: 'fa-solid fa-clipboard-list',
    href: '/legal/verwerkingsregister',
  },
  {
    title: 'DPIA',
    description: 'Data Protection Impact Assessment voor het Buuur platform.',
    icon: 'fa-solid fa-magnifying-glass-chart',
    href: '/legal/dpia',
  },
]

export default function LegalOverview() {
  const { isPlatformAdmin } = useAuth()

  return (
    <div className="login-page" style={{ alignItems: 'flex-start', overflow: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px', width: '100%' }}>
        <h1 style={{ marginBottom: 8 }}>Juridische documenten</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
          Alle juridische documentatie van het Buuur platform op één plek.
        </p>

        {/* Publieke documenten */}
        <h2 style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Openbaar
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {PUBLIC_DOCS.map(doc => (
            <DocCard key={doc.href} {...doc} />
          ))}
        </div>

        {/* Interne documenten — alleen voor platform admins */}
        {isPlatformAdmin && (
          <>
            <h2 style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Intern (alleen platform admins)
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {INTERNAL_DOCS.map(doc => (
                <DocCard key={doc.href} {...doc} />
              ))}
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/login" className="cl-btn cl-btn--secondary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            <i className="fa-solid fa-arrow-left" /> Terug
          </a>
        </div>
      </div>
    </div>
  )
}

function DocCard({ title, description, icon, href }) {
  return (
    <a
      href={href}
      className="cl-card cl-card--elevated"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 20px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform 150ms, box-shadow 150ms',
        cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <i className={icon} style={{ fontSize: 24, color: 'var(--accent-primary)', flexShrink: 0, width: 32, textAlign: 'center' }} />
      <div>
        <strong style={{ display: 'block', marginBottom: 2 }}>{title}</strong>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{description}</span>
      </div>
      <i className="fa-solid fa-chevron-right" style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', flexShrink: 0 }} />
    </a>
  )
}
