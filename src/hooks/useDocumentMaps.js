import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { toStoragePath, uploadFile } from '../lib/storage'
import { logger, friendlyError } from '../lib/logger'
import { dispatchNotification } from '../lib/notifications'

/**
 * Documenten in mappen (migratie 129).
 *
 * Een map heeft een beheergroep (of geen: dan beheren moderators hem) en een
 * zichtbaarheid. Daarin één laag submappen. Documenten met map_id volgen de
 * map; oude groepsdocumenten zonder map_id (gedeeld met meerdere groepen)
 * staan los in elke groepsmap waarmee ze gedeeld zijn.
 *
 * De database bewaakt wie wat mag; de checks hier bepalen alleen welke knoppen
 * je ziet.
 */
export function useDocumentMaps() {
  const { user } = useAuth()
  const { project } = useProject()
  const projectId = project?.id

  const [maps, setMaps] = useState([])
  const [folders, setFolders] = useState([])
  const [docs, setDocs] = useState([])
  const [meetingFiles, setMeetingFiles] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!projectId) return
    const [mapRes, folderRes, docRes, meetingRes] = await Promise.all([
      supabase.from('document_maps')
        .select('id, name, audience, kind, owner_workgroup_id, position, owner:workgroups(id, name)')
        .eq('project_id', projectId)
        .order('position').order('name'),
      supabase.from('document_folders')
        .select('id, map_id, name, group_only, position, map:document_maps!inner(project_id)')
        .eq('map.project_id', projectId)
        .order('position').order('name'),
      supabase.from('documents')
        .select('*, uploader:profiles!uploaded_by(id, full_name, avatar_url)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase.from('meeting_files')
        .select(`
          id, file_name, file_path, file_size, file_type, category, created_at,
          meeting:meetings!inner(id, title, date, project_id),
          uploader:profiles(id, full_name, avatar_url)
        `)
        .eq('meeting.project_id', projectId)
        .order('created_at', { ascending: false }),
    ])
    for (const r of [mapRes, folderRes, docRes, meetingRes]) {
      if (r.error) logger.error('useDocumentMaps.fetch', r.error)
    }

    // Oude groepsdocumenten zonder map: met welke groepen ze gedeeld zijn.
    const legacyIds = (docRes.data || []).filter(d => !d.map_id && d.visibility === 'groups').map(d => d.id)
    const groupMap = {}
    if (legacyIds.length) {
      const { data: links } = await supabase.from('document_groups')
        .select('document_id, workgroup_id').in('document_id', legacyIds)
      for (const l of links || []) (groupMap[l.document_id] ||= []).push(l.workgroup_id)
    }

    setMaps(mapRes.data || [])
    setFolders((folderRes.data || []).map(({ map: _m, ...f }) => f))
    setDocs((docRes.data || []).map(d => ({
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
      visibility: d.visibility,
      map_id: d.map_id,
      folder_id: d.folder_id,
      pinned: !!d.pinned,
      author: d.uploader,
      uploaded_by: d.uploaded_by,
      created_at: d.created_at,
      workgroup_ids: groupMap[d.id] || [],
    })))
    setMeetingFiles((meetingRes.data || []).map(f => ({
      id: f.id,
      source: 'vergadering',
      doc_type: 'file',
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
    })))
    setLoading(false)
  }, [projectId])

  useEffect(() => { setLoading(true); fetchAll() }, [fetchAll])

  // Live bijwerken als iemand anders iets toevoegt of verplaatst.
  useEffect(() => {
    if (!projectId) return
    const channel = supabase.channel(`documents-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `project_id=eq.${projectId}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_maps', filter: `project_id=eq.${projectId}` }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, fetchAll])

  const mapById = useMemo(() => Object.fromEntries(maps.map(m => [m.id, m])), [maps])
  const folderById = useMemo(() => Object.fromEntries(folders.map(f => [f.id, f])), [folders])
  const membersMap = useMemo(() => maps.find(m => m.kind === 'members') || null, [maps])

  // Documenten in een map: met map_id, plus oude stukken die erbij horen.
  const docsInMap = useCallback((map) => {
    if (!map) return []
    return docs.filter(d => {
      if (d.map_id) return d.map_id === map.id
      if (d.visibility === 'public') return map.kind === 'public'
      if (d.visibility === 'members') return map.kind === 'members'
      return !!map.owner_workgroup_id && d.workgroup_ids.includes(map.owner_workgroup_id)
    })
  }, [docs])

  // Waar een document staat, voor zoeken en Recent.
  const placeOf = useCallback((doc) => {
    if (doc.source === 'vergadering') {
      return membersMap ? { map: membersMap, folderId: 'vergaderingen', label: `${membersMap.name} / Uit vergaderingen` } : null
    }
    let map = doc.map_id ? mapById[doc.map_id] : null
    if (!map) map = maps.find(m => docsInMap(m).some(d => d.id === doc.id)) || null
    if (!map) return null
    const folder = doc.folder_id ? folderById[doc.folder_id] : null
    return { map, folderId: folder?.id || null, label: folder ? `${map.name} / ${folder.name}` : map.name }
  }, [mapById, folderById, maps, docsInMap, membersMap])

  // ===== Schrijven =====

  function insertError(err, where) {
    logger.error(where, err)
    return new Error(friendlyError(err))
  }

  function notifyIfBroad(docId, mapId) {
    // De edge function stuurt alleen naar wie het document mag lezen.
    if (mapId) dispatchNotification({ projectId, type: 'new_document', referenceId: docId, actorId: user?.id })
  }

  async function addFile({ title, description, mapId, folderId, pinned, file }) {
    let path
    try {
      ({ path } = await uploadFile(file, 'project-files', `documents/${projectId}`))
    } catch (err) {
      logger.error('useDocumentMaps.addFile', err)
      throw new Error(err?.message?.startsWith('Bestand') ? err.message : friendlyError(err))
    }
    const { data, error } = await supabase.from('documents').insert({
      project_id: projectId, title, description: description || null,
      map_id: mapId, folder_id: folderId || null, pinned: !!pinned,
      doc_type: 'file', file_name: file.name, file_path: path,
      file_size: file.size, file_type: file.type, uploaded_by: user?.id,
    }).select('id').single()
    if (error) {
      await supabase.storage.from('project-files').remove([path])
      throw insertError(error, 'useDocumentMaps.addFile')
    }
    notifyIfBroad(data.id, mapId)
    fetchAll()
  }

  async function addLink({ title, description, mapId, folderId, pinned, url }) {
    const { data, error } = await supabase.from('documents').insert({
      project_id: projectId, title, description: description || null,
      map_id: mapId, folder_id: folderId || null, pinned: !!pinned,
      doc_type: 'link', url, file_name: title, file_path: url,
      uploaded_by: user?.id,
    }).select('id').single()
    if (error) throw insertError(error, 'useDocumentMaps.addLink')
    notifyIfBroad(data.id, mapId)
    fetchAll()
  }

  // Bijwerken met select(): RLS weigert stil (0 rijen), dat melden we.
  async function updateDoc(id, patch) {
    const { data, error } = await supabase.from('documents').update(patch).eq('id', id).select('id')
    if (error || !data?.length) {
      logger.error('useDocumentMaps.updateDoc', error || new Error('geen rij bijgewerkt'))
      throw new Error(error ? friendlyError(error) : 'Je mag dit document niet aanpassen.')
    }
    fetchAll()
  }

  async function removeDoc(doc) {
    const table = doc.source === 'vergadering' ? 'meeting_files' : 'documents'
    const { data, error } = await supabase.from(table).delete().eq('id', doc.id).select('id')
    if (error || !data?.length) {
      logger.error('useDocumentMaps.removeDoc', error || new Error('geen rij verwijderd'))
      throw new Error(error ? friendlyError(error) : 'Je mag dit document niet verwijderen.')
    }
    if (doc.doc_type !== 'link') {
      const storagePath = toStoragePath(doc.file_path)
      if (storagePath) await supabase.storage.from('project-files').remove([storagePath])
    }
    fetchAll()
  }

  async function saveMap(id, { name, ownerWorkgroupId, audience }) {
    const row = { name: name.trim(), owner_workgroup_id: ownerWorkgroupId || null, audience }
    const q = id
      ? supabase.from('document_maps').update(row).eq('id', id).select('id').single()
      : supabase.from('document_maps').insert({
          ...row, project_id: projectId, position: 10 + maps.length,
        }).select('id').single()
    const { data, error } = await q
    if (error) throw insertError(error, 'useDocumentMaps.saveMap')
    await fetchAll()
    return data.id
  }

  async function deleteMap(id) {
    const { data, error } = await supabase.from('document_maps').delete().eq('id', id).select('id')
    if (error || !data?.length) {
      logger.error('useDocumentMaps.deleteMap', error || new Error('geen rij verwijderd'))
      throw new Error(error?.code === '23503'
        ? 'Er staan nog documenten in deze map. Verplaats of verwijder ze eerst.'
        : error ? friendlyError(error) : 'Je mag deze map niet verwijderen.')
    }
    fetchAll()
  }

  async function saveFolder(id, { mapId, name, groupOnly }) {
    const row = { name: name.trim(), group_only: !!groupOnly }
    const q = id
      ? supabase.from('document_folders').update(row).eq('id', id).select('id').single()
      : supabase.from('document_folders').insert({
          ...row, map_id: mapId, position: folders.filter(f => f.map_id === mapId).length,
        }).select('id').single()
    const { data, error } = await q
    if (error) throw insertError(error, 'useDocumentMaps.saveFolder')
    await fetchAll()
    return data.id
  }

  async function deleteFolder(id) {
    const { data, error } = await supabase.from('document_folders').delete().eq('id', id).select('id')
    if (error || !data?.length) {
      logger.error('useDocumentMaps.deleteFolder', error || new Error('geen rij verwijderd'))
      throw new Error(error ? friendlyError(error) : 'Je mag deze submap niet verwijderen.')
    }
    fetchAll()
  }

  return {
    maps, folders, docs, meetingFiles, loading,
    mapById, folderById, membersMap, docsInMap, placeOf,
    addFile, addLink, updateDoc, removeDoc,
    saveMap, deleteMap, saveFolder, deleteFolder,
    refetch: fetchAll,
  }
}
