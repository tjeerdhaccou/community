import { useState, useRef } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import { uploadImage } from '../lib/storage'
import { getIntakeUrl, getProjectBaseUrl } from '../lib/subdomain'
import useIntakeQuestions from '../hooks/useIntakeQuestions'
import useIntakeResponses from '../hooks/useIntakeResponses'
import IntakeQuestionEditor from '../components/IntakeQuestionEditor'
import IntakeResponseDetail from '../components/IntakeResponseDetail'
import ImageCropper from '../components/ImageCropper'

export default function Ledenwerving() {
  const { project } = useProject()
  const { questions, addQuestion, updateQuestion, deleteQuestion, reorderQuestions } = useIntakeQuestions(project?.id)
  const { responses, pending, invited, joined, rejected, updateStatus } = useIntakeResponses(project?.id, project?.name, getProjectBaseUrl(project))

  const [tab, setTab] = useState('responses') // responses | form
  const [selectedResponse, setSelectedResponse] = useState(null)
  const [intakeEnabled, setIntakeEnabled] = useState(project?.intake_enabled || false)
  const [intakeIntro, setIntakeIntro] = useState(project?.intake_intro_text || '')
  const [coverUrl, setCoverUrl] = useState(project?.cover_image_url || '')
  const [coverPreview, setCoverPreview] = useState(project?.cover_image_url || '')
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverRef = useRef(null)
  const [cropSrc, setCropSrc] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const intakeUrl = getIntakeUrl(project)

  async function handleCoverCropComplete(blob) {
    const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
    setCropSrc(null)
    setCoverPreview(URL.createObjectURL(blob))
    setUploadingCover(true)
    try {
      const url = await uploadImage(file)
      setCoverUrl(url)
    } catch (err) {
      console.error('Cover upload failed:', err)
      setCoverPreview(coverUrl || '')
    } finally {
      setUploadingCover(false)
    }
  }

  async function handleSaveSettings() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('projects')
      .update({
        intake_enabled: intakeEnabled,
        intake_intro_text: intakeIntro.trim() || null,
        cover_image_url: coverUrl || null,
      })
      .eq('id', project.id)
    if (error) {
      console.error('Save intake settings error:', error)
      alert('Opslaan mislukt.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  return (
    <div className="view-ledenwerving">
      <div className="view-header">
        <div className="view-header__row">
          <div>
            <h1>Ledenwerving</h1>
            <p className="view-header__subtitle">
              {pending.length > 0 ? `${pending.length} nieuwe aanmeldingen` : 'Beheer je intake formulier en aanmeldingen'}
            </p>
          </div>
        </div>
      </div>

      {/* Tab pills */}
      <div className="tag-filter">
        <button
          className={`tag-filter__pill ${tab === 'responses' ? 'tag-filter__pill--active' : ''}`}
          onClick={() => setTab('responses')}
        >
          Aanmeldingen {pending.length > 0 && <span className="tag-filter__count">{pending.length}</span>}
        </button>
        <button
          className={`tag-filter__pill ${tab === 'form' ? 'tag-filter__pill--active' : ''}`}
          onClick={() => setTab('form')}
        >
          Formulier instellingen
        </button>
      </div>

      {tab === 'responses' && (
        <div className="ledenwerving-responses">
          {/* Quick link */}
          {intakeEnabled && (
            <div className="ledenwerving-url-bar">
              <span className="ledenwerving-url-bar__label">
                <i className="fa-solid fa-link" /> Deel deze link:
              </span>
              <input type="text" readOnly value={intakeUrl} className="ledenwerving-url-bar__input" />
              <button
                className="btn-secondary btn-sm"
                onClick={() => navigator.clipboard.writeText(intakeUrl)}
              >
                <i className="fa-solid fa-copy" /> Kopieer
              </button>
            </div>
          )}

          {!intakeEnabled && (
            <div className="ledenwerving-empty">
              <i className="fa-solid fa-clipboard-list" />
              <h3>Intake formulier is niet actief</h3>
              <p>Ga naar "Formulier instellingen" om het intake formulier aan te zetten en vragen te configureren.</p>
              <button className="btn-primary" onClick={() => setTab('form')}>
                <i className="fa-solid fa-gear" /> Formulier instellen
              </button>
            </div>
          )}

          {intakeEnabled && responses.length === 0 && (
            <div className="ledenwerving-empty">
              <i className="fa-solid fa-envelope-open" />
              <h3>Nog geen aanmeldingen</h3>
              <p>Deel je intake link op je website of social media om geïnteresseerden te bereiken.</p>
            </div>
          )}

          {/* Response list grouped by status */}
          {pending.length > 0 && (
            <ResponseSection
              title="Nieuw"
              responses={pending}
              onSelect={setSelectedResponse}
              pillClass="intake-pill--pending"
            />
          )}

          {invited.length > 0 && (
            <ResponseSection
              title="Uitgenodigd"
              responses={invited}
              onSelect={setSelectedResponse}
              pillClass="intake-pill--invited"
            />
          )}

          {joined.length > 0 && (
            <ResponseSection
              title="Lid geworden"
              responses={joined}
              onSelect={setSelectedResponse}
              pillClass="intake-pill--joined"
            />
          )}

          {rejected.length > 0 && (
            <ResponseSection
              title="Afgewezen"
              responses={rejected}
              onSelect={setSelectedResponse}
              pillClass="intake-pill--rejected"
            />
          )}
        </div>
      )}

      {tab === 'form' && (
        <div className="ledenwerving-settings">
          <div className="ledenwerving-card">
            <h3>Formulier status</h3>
            <label className="intake-toggle">
              <input
                type="checkbox"
                checked={intakeEnabled}
                onChange={e => setIntakeEnabled(e.target.checked)}
              />
              <span>Intake formulier actief</span>
            </label>

            {intakeEnabled && (
              <div className="ledenwerving-url-bar" style={{ marginTop: 16 }}>
                <input type="text" readOnly value={intakeUrl} className="ledenwerving-url-bar__input" />
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => navigator.clipboard.writeText(intakeUrl)}
                >
                  <i className="fa-solid fa-copy" /> Kopieer
                </button>
              </div>
            )}
          </div>

          <div className="ledenwerving-card">
            <h3>Cover afbeelding</h3>
            <p className="form-hint">Wordt bovenaan het intake formulier getoond.</p>
            {coverPreview ? (
              <div className="settings-cover-preview">
                <img src={coverPreview} alt="Cover preview" />
                <div className="settings-cover-preview__actions">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => coverRef.current?.click()} disabled={uploadingCover}>
                    {uploadingCover ? 'Uploaden...' : 'Wijzigen'}
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => { setCoverUrl(''); setCoverPreview('') }} style={{ color: 'var(--accent-red)' }}>
                    Verwijderen
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => coverRef.current?.click()} disabled={uploadingCover}>
                <i className="fa-solid fa-image" /> {uploadingCover ? 'Uploaden...' : 'Afbeelding kiezen'}
              </button>
            )}
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setCropSrc(URL.createObjectURL(file))
                e.target.value = ''
              }}
              style={{ display: 'none' }}
            />
          </div>

          <div className="ledenwerving-card">
            <h3>Introductietekst</h3>
            <p className="form-hint">Dit bericht verschijnt boven het formulier.</p>
            <textarea
              value={intakeIntro}
              onChange={e => setIntakeIntro(e.target.value)}
              rows={3}
              placeholder="Welkomstbericht dat boven het formulier verschijnt..."
            />
          </div>

          <div className="ledenwerving-card">
            <h3>Vragen</h3>
            <p className="form-hint">Stel de vragen in die geïnteresseerden moeten beantwoorden.</p>
            <IntakeQuestionEditor
              questions={questions}
              onAdd={addQuestion}
              onUpdate={updateQuestion}
              onDelete={deleteQuestion}
              onReorder={reorderQuestions}
            />
          </div>

          <button className="btn-primary" onClick={handleSaveSettings} disabled={saving}>
            {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen' : 'Instellingen opslaan'}
          </button>
        </div>
      )}

      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          aspect={16 / 9}
          round={false}
          onComplete={handleCoverCropComplete}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {selectedResponse && (
        <IntakeResponseDetail
          response={selectedResponse}
          questions={questions}
          onClose={() => setSelectedResponse(null)}
          onInvite={async () => { await updateStatus(selectedResponse.id, 'invited') }}
          onReject={async () => { await updateStatus(selectedResponse.id, 'rejected') }}
        />
      )}
    </div>
  )
}

function ResponseSection({ title, responses, onSelect, pillClass }) {
  return (
    <div className="ledenwerving-section">
      <h3 className="ledenwerving-section__title">{title} ({responses.length})</h3>
      <div className="ledenwerving-list">
        {responses.map(r => (
          <div key={r.id} className="member-row" onClick={() => onSelect(r)} role="button" tabIndex={0}>
            <div className="member-row__left">
              <div className="member-row__avatar member-row__avatar--placeholder">
                {r.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <span className="member-row__name">{r.name}</span>
                <span className="member-row__meta">
                  {r.email} · {new Date(r.created_at).toLocaleDateString('nl-NL')}
                  {r.status === 'invited' && r.invited_at && (
                    <> · uitgenodigd {new Date(r.invited_at).toLocaleDateString('nl-NL')}</>
                  )}
                </span>
              </div>
            </div>
            <div className="member-row__right">
              {r.status === 'invited' && (
                <span className="ledenwerving-status-icon ledenwerving-status-icon--invited" title="Uitgenodigd">
                  <i className="fa-solid fa-paper-plane" />
                </span>
              )}
              {r.status === 'joined' && (
                <span className="ledenwerving-status-icon ledenwerving-status-icon--joined" title="Actief">
                  <i className="fa-solid fa-circle-check" />
                </span>
              )}
              {r.status === 'rejected' && (
                <span className="ledenwerving-status-icon ledenwerving-status-icon--rejected" title="Afgewezen">
                  <i className="fa-solid fa-circle-xmark" />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
