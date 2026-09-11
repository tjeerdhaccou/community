import MemberPicker from './MemberPicker'

/** Kies één lid → start (of hervat) een 1-op-1-gesprek. */
export default function NewDirectModal({ excludeIds = [], onPick, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--chat" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="newdirect-title">
        <div className="modal-header">
          <h2 id="newdirect-title">Bericht aan een lid</h2>
          <button className="modal-close" onClick={onClose} aria-label="Sluiten"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </div>
        <div className="modal-form">
          <MemberPicker mode="single" excludeIds={excludeIds} onPick={onPick} />
          <p className="chat-modal__hint">Bestaat er al een gesprek, dan open je dat. Beheerders kunnen jullie berichten niet lezen.</p>
        </div>
      </div>
    </div>
  )
}
