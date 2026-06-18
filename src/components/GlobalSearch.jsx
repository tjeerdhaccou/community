import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProject } from '../contexts/ProjectContext'
import { timeAgo, formatFileSize, fileIcon, fileIconColor } from '../lib/constants'
import { openProjectFile } from '../lib/storage'

export default function GlobalSearch() {
  const { project, basePath } = useProject()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  const projectId = project?.id

  const search = useCallback(async (q) => {
    if (!q.trim() || !projectId) { setResults(null); return }
    setLoading(true)

    const term = `%${q.trim()}%`
    const [updates, decisions, documents, meetingFiles, proUpdates] = await Promise.all([
      supabase.from('updates').select('id, title, body, tag, created_at').eq('project_id', projectId).or(`title.ilike.${term},body.ilike.${term}`).limit(5),
      supabase.from('decisions').select('id, text, created_at, meeting:meetings(id, title, project_id)').ilike('text', term).limit(5),
      supabase.from('documents').select('id, title, description, file_name, file_path, file_type, file_size, category, created_at').eq('project_id', projectId).or(`title.ilike.${term},description.ilike.${term},file_name.ilike.${term}`).limit(5),
      supabase.from('meeting_files').select('id, file_name, file_path, file_type, file_size, category, created_at, meeting:meetings(id, title, project_id)').ilike('file_name', term).limit(5),
      supabase.from('professional_updates').select('id, title, body, created_at').eq('project_id', projectId).or(`title.ilike.${term},body.ilike.${term}`).limit(5),
    ])

    // Filter decisions/meeting_files to this project
    const filteredDecisions = (decisions.data || []).filter(d => d.meeting?.project_id === projectId)
    const filteredMeetingFiles = (meetingFiles.data || []).filter(f => f.meeting?.project_id === projectId)

    setResults({
      updates: updates.data || [],
      decisions: filteredDecisions,
      documents: documents.data || [],
      meetingFiles: filteredMeetingFiles,
      proUpdates: proUpdates.data || [],
    })
    setLoading(false)
  }, [projectId])

  function handleInput(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(timerRef.current)
    if (val.trim().length >= 2) {
      timerRef.current = setTimeout(() => search(val), 300)
    } else {
      setResults(null)
    }
  }

  function handleOpen() {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function handleClose() {
    setOpen(false)
    setQuery('')
    setResults(null)
  }

  function goTo(path) {
    handleClose()
    navigate(path)
  }

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const totalResults = results ? Object.values(results).reduce((sum, arr) => sum + arr.length, 0) : 0

  return (
    <div className={`global-search ${open ? 'global-search--open' : ''}`}>
      <button className="global-search-trigger" onClick={open ? handleClose : handleOpen} title="Zoeken (Ctrl+K)" aria-label="Zoeken">
        <i className={`fa-solid ${open ? 'fa-xmark' : 'fa-magnifying-glass'}`} />
      </button>

      <div className="global-search-bar">
        <input ref={inputRef} type="text" value={query} onChange={handleInput}
          placeholder="Zoeken..." aria-label="Zoeken" />
      </div>

      {open && (results || loading) && (
        <div className="global-search-dropdown">
          {loading && <div className="global-search-loading">Zoeken...</div>}

          {results && !loading && (
            <div className="global-search-results">
              {totalResults === 0 ? (
                <div className="global-search-empty">
                  <p>Geen resultaten voor "{query}"</p>
                </div>
              ) : (
                <>
                  {results.updates.length > 0 && (
                    <SearchSection title="Projectnieuws" icon="fa-solid fa-bullhorn">
                      {results.updates.map(u => (
                        <SearchItem key={u.id} title={u.title} subtitle={u.body?.slice(0, 100)} time={u.created_at} tag={u.tag} onClick={() => goTo(`${basePath}/updates?item=${u.id}`)} />
                      ))}
                    </SearchSection>
                  )}
                  {results.decisions.length > 0 && (
                    <SearchSection title="Besluiten" icon="fa-solid fa-gavel">
                      {results.decisions.map(d => (
                        <SearchItem key={d.id} title={d.text} subtitle={d.meeting?.title ? `Vergadering: ${d.meeting.title}` : ''} time={d.created_at} onClick={() => goTo(`${basePath}/events`)} />
                      ))}
                    </SearchSection>
                  )}
                  {results.documents.length > 0 && (
                    <SearchSection title="Documenten" icon="fa-solid fa-folder">
                      {results.documents.map(d => (
                        <SearchItem key={d.id} title={d.title} subtitle={d.file_name}
                          time={d.created_at} onClick={() => openProjectFile(d.file_path)} fileType={d.file_type} />
                      ))}
                    </SearchSection>
                  )}
                  {results.meetingFiles.length > 0 && (
                    <SearchSection title="Vergader-bestanden" icon="fa-solid fa-paperclip">
                      {results.meetingFiles.map(f => (
                        <SearchItem key={f.id} title={f.file_name}
                          subtitle={f.meeting?.title ? `Vergadering: ${f.meeting.title}` : ''}
                          time={f.created_at} onClick={() => openProjectFile(f.file_path)} fileType={f.file_type} />
                      ))}
                    </SearchSection>
                  )}
                  {results.proUpdates.length > 0 && (
                    <SearchSection title="Adviseur updates" icon="fa-solid fa-hard-hat">
                      {results.proUpdates.map(u => (
                        <SearchItem key={u.id} title={u.title} subtitle={u.body?.slice(0, 100)} time={u.created_at} onClick={() => goTo(`${basePath}/pro-updates`)} />
                      ))}
                    </SearchSection>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SearchSection({ title, icon, children }) {
  return (
    <div className="search-section">
      <h4 className="search-section__title"><i className={icon} /> {title}</h4>
      <div className="search-section__list">{children}</div>
    </div>
  )
}

function SearchItem({ title, subtitle, time, tag, href, fileType, onClick }) {
  const content = (
    <>
      <div className="search-item__left">
        {fileType && <i className={fileIcon(fileType)} style={{ color: fileIconColor(fileType) }} />}
        <div>
          <span className="search-item__title">{title}</span>
          {subtitle && <span className="search-item__subtitle">{subtitle}</span>}
        </div>
      </div>
      <span className="search-item__time">{timeAgo(time)}</span>
    </>
  )

  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="search-item">{content}</a>
  }
  if (onClick) {
    return <button type="button" className="search-item" onClick={onClick}>{content}</button>
  }
  return <div className="search-item">{content}</div>
}
