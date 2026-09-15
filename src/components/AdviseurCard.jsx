import { PROFESSIONAL_LABELS, PROFESSIONAL_COLORS, tagStyle } from '../lib/constants'

export default function AdviseurCard({ profile, onEdit }) {
  const color = PROFESSIONAL_COLORS[profile.professional_type] || '#9ba1b0'
  const typeLabel = PROFESSIONAL_LABELS[profile.professional_type] || 'Adviseur'
  const initials = (profile.full_name || 'A').split(' ').map(n => n[0]).join('').slice(0, 2)

  return (
    <div className="adviseur-card">
      {/* Photo + badge row */}
      <div className="adviseur-card__top">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.full_name || ''} className="adviseur-card__photo" />
        ) : (
          <div className="adviseur-card__photo adviseur-card__photo--placeholder" style={{ background: color }}>
            {initials}
          </div>
        )}
      </div>

      <h3 className="adviseur-card__name">{profile.full_name}</h3>
      <span className="pro-badge" style={tagStyle(color)}>{typeLabel}</span>

      {profile.company && (
        <p className="adviseur-card__company">{profile.company}</p>
      )}

      {profile.bio && (
        <p className="adviseur-card__bio">{profile.bio}</p>
      )}

      {(profile.phone || profile.website) && (
        <div className="adviseur-card__contact">
          {profile.phone && (
            <a href={`tel:${profile.phone}`} className="adviseur-card__link">
              <i className="fa-solid fa-phone" /> {profile.phone}
            </a>
          )}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer" className="adviseur-card__link">
              <i className="fa-solid fa-globe" /> Website
            </a>
          )}
        </div>
      )}

      {onEdit && (
        <button className="adviseur-card__edit" onClick={() => onEdit(profile)} aria-label="Bewerken">
          <i className="fa-solid fa-pen" />
        </button>
      )}
    </div>
  )
}
