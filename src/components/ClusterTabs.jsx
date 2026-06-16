/**
 * ClusterTabs — top-level tab bar voor geclusterde views (Leden, Organisatie,
 * Documenten). Onderscheidt zich visueel van de pill-tabs (.seg-tabs) binnen de
 * onderliggende views door een underline-stijl, zodat twee tab-niveaus naast
 * elkaar leesbaar blijven.
 *
 * tabs: [{ key, label, icon?, count? }]
 */
export default function ClusterTabs({ tabs, value, onChange }) {
  if (tabs.length < 2) return null
  return (
    <div className="cluster-tabs" role="tablist">
      {tabs.map(t => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          className={`cluster-tab ${value === t.key ? 'cluster-tab--active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.icon && <i className={t.icon} />}
          {t.label}
          {t.count > 0 && <span className="cluster-tab__count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
