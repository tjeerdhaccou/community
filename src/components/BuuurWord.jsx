/**
 * Het woordmerk met de drie u's als beweging: bij binnenkomst veren ze één
 * voor één op; als laadindicator blijven ze rustig golven.
 */
export default function BuuurWord({ loading = false, className = '' }) {
  return (
    <span className={`buuur ${loading ? 'buuur--loading' : ''} ${className}`} aria-label="buuur">
      <span aria-hidden="true">b</span>
      {[0, 1, 2].map((i) => (
        <span key={i} className="buuur__u" style={{ '--i': i }} aria-hidden="true">u</span>
      ))}
      <span aria-hidden="true">r</span>
    </span>
  )
}
