/**
 * Avatar voor de chat: foto → emoji (groep) → icoon → initialen.
 * Volledig token-gedreven via .chat-av in Chat.css.
 */
export default function Avatar({ url, name, emoji, icon, size = 40, className = '' }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) }
  if (emoji) {
    return <span className={`chat-av chat-av--emoji ${className}`} style={{ ...style, fontSize: Math.round(size * 0.5) }}>{emoji}</span>
  }
  if (url) return <img className={`chat-av ${className}`} style={style} src={url} alt={name || ''} />
  if (icon) {
    return <span className={`chat-av chat-av--icon ${className}`} style={style}><i className={icon} aria-hidden="true" /></span>
  }
  const initials = (name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  return <span className={`chat-av chat-av--initials ${className}`} style={style}>{initials}</span>
}
