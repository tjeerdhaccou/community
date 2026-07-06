import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { toStoragePath } from '../lib/storage'

/**
 * Unified document hook that combines:
 * - Project documents (with visibility + category + group links)
 * - Meeting files (agendas, minutes, presentations from events)
 *
 * Adviseur-documenten are no longer included in the frontend;
 * they are managed via the CMS and promoted to the project dossier.
 */
export function useAllDocuments() {
  const { user } = useAuth()
  const { project } = useProject()
  const [projectDocs, setProjectDocs] = useState([])
  const [meetingFiles, setMeetingFiles] = useState([])
  const [loading, setLoading] = useState(true)

  const projectId = project?.id

  const fetchAll = useCallback(async () => {
    if (!projectId) return
    setLoading(true)

    const [docRes, meetingRes] = await Promise.all([
      // Project documents (RLS handles visibility filtering)
      supabase
        .from('documents')
        .select('*, uploader:profiles!uploaded_by(id, full_name, avatar_url)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),

      // Meeting files (joined with meeting)
      supabase
        .from('meeting_files')
        .select(`
          id, file_name, file_path, file_size, file_type, category, created_at,
          meeting:meetings(id, title, date, project_id),
          uploader:profiles(id, full_name, avatar_url)
        `)
        .order('created_at', { ascending: false }),
    ])

    // Get document_groups for the fetched docs
    const docIds = (docRes.data || []).map(d => d.id)
    let groupLinks = []
    if (docIds.length > 0) {
      const { data: links } = await supabase
        .from('document_groups')
        .select('document_id, workgroup_id')
        .in('document_id', docIds)
      groupLinks = links || []
    }

    // Build group map: document_id → [workgroup_id, ...]
    const groupMap = {}
    for (const link of groupLinks) {
      if (!groupMap[link.document_id]) groupMap[link.document_id] = []
      groupMap[link.document_id].push(link.workgroup_id)
    }

    // Map project documents
    const docs = (docRes.data || []).map(d => ({
      id: d.id,
      source: 'document',
      doc_type: d.doc_type || 'file',
      share_code: d.share_code,
      url: d.url,
      file_name: d.file_name,
      file_path: d.file_path,
      file_size: d.file_size,
      file_type: d.file_type,
      title: d.title,
      description: d.description,
      category: d.category,
      visibility: d.visibility,
      phase: d.phase,
      author: d.uploader,
      created_at: d.created_at,
      workgroup_ids: groupMap[d.id] || [],
    }))

    // Filter meeting files to this project
    const mFiles = (meetingRes.data || []).filter(f =>
      f.meeting?.project_id === projectId
    ).map(f => ({
      id: f.id,
      source: 'vergadering',
      file_name: f.file_name,
      file_path: f.file_path,
      file_size: f.file_size,
      file_type: f.file_type,
      title: f.file_name,
      subcategory: f.category,
      meeting_title: f.meeting?.title,
      meeting_date: f.meeting?.date,
      author: f.uploader,
      created_at: f.created_at,
    }))

    setProjectDocs(docs)
    setMeetingFiles(mFiles)
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Public docs (for "Het gebouw" and "Praktische info" tabs)
  const publicDocs = useMemo(() =>
    projectDocs.filter(d => d.visibility === 'public'),
    [projectDocs]
  )

  const gebouwDocs = useMemo(() =>
    publicDocs.filter(d => d.category === 'ontwerp_visualisatie'),
    [publicDocs]
  )

  const infoDocs = useMemo(() =>
    publicDocs.filter(d => d.category === 'verkoop_informatie'),
    [publicDocs]
  )

  // Other public docs that don't fit gebouw or info
  const otherPublicDocs = useMemo(() =>
    publicDocs.filter(d => d.category !== 'ontwerp_visualisatie' && d.category !== 'verkoop_informatie'),
    [publicDocs]
  )

  // Members-only docs (for "Projectdossier" tab)
  const memberDocs = useMemo(() =>
    projectDocs.filter(d => d.visibility === 'members'),
    [projectDocs]
  )

  // Group docs: filtered by workgroup_ids the user belongs to
  // (RLS already filters, but this helps group per workgroup tab)
  const groupDocs = useMemo(() =>
    projectDocs.filter(d => d.visibility === 'groups'),
    [projectDocs]
  )

  // Get docs for a specific workgroup
  function getDocsForWorkgroup(workgroupId) {
    return groupDocs.filter(d => d.workgroup_ids.includes(workgroupId))
  }

  // All combined (for search)
  const allDocuments = useMemo(() => {
    return [...projectDocs, ...meetingFiles]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [projectDocs, meetingFiles])

  // Upload a new document (from frontend — moderators only)
  async function uploadDocument({ title, description, category, visibility, groupIds, file }) {
    const path = `documents/${projectId}/${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage.from('project-files').upload(path, file)
    if (upErr) throw upErr

    const { data: doc, error } = await supabase.from('documents').insert({
      project_id: projectId, title, description: description || null,
      category: category || 'overig',
      visibility: visibility || 'members',
      file_name: file.name, file_path: path,
      file_size: file.size, file_type: file.type, uploaded_by: user?.id,
    }).select('id').single()
    if (error) throw error

    // Insert group links
    if (visibility === 'groups' && groupIds?.length > 0) {
      await supabase.from('document_groups')
        .insert(groupIds.map(gid => ({ document_id: doc.id, workgroup_id: gid })))
    }

    fetchAll()
  }

  // Save a link
  async function saveLink({ title, description, category, visibility, groupIds, url }) {
    const { data: doc, error } = await supabase.from('documents').insert({
      project_id: projectId, title, description: description || null,
      category: category || 'overig',
      visibility: visibility || 'members',
      doc_type: 'link', url,
      file_name: title, file_path: url,
      uploaded_by: user?.id,
    }).select('id').single()
    if (error) throw error

    if (visibility === 'groups' && groupIds?.length > 0) {
      await supabase.from('document_groups')
        .insert(groupIds.map(gid => ({ document_id: doc.id, workgroup_id: gid })))
    }

    fetchAll()
  }

  async function removeDoc(id, source, filePath) {
    const storagePath = toStoragePath(filePath)
    if (storagePath) {
      await supabase.storage.from('project-files').remove([storagePath])
    }

    if (source === 'document') {
      await supabase.from('document_groups').delete().eq('document_id', id)
      await supabase.from('documents').delete().eq('id', id)
    } else if (source === 'vergadering') {
      await supabase.from('meeting_files').delete().eq('id', id)
    }
    fetchAll()
  }

  return {
    allDocuments,
    gebouwDocs,
    infoDocs,
    otherPublicDocs,
    memberDocs,
    groupDocs,
    getDocsForWorkgroup,
    vergaderingDocs: meetingFiles,
    loading,
    uploadDocument,
    saveLink,
    removeDoc,
    refetch: fetchAll,
  }
}
