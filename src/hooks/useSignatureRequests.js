import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { logger } from '../lib/logger'

// Tekenverzoeken die aan de huidige user gericht zijn, gescoped op het huidige
// project. Elke rij = één signer-koppeling met de bijbehorende request-info.
//
// Mapping van DB-velden:
//   - signer_id        = signature_request_signers.id (de eigen rij voor de user)
//   - request_id       = signature_requests.id
//   - status           = 'pending' | 'viewed' | 'signed' | 'declined' (per signer)
//   - request_status   = 'open' | 'completed' | 'cancelled' (van het hele verzoek)
//   - file_path        = origineel PDF in storage bucket "signatures"
//   - placement_*      = waar het handtekening-blok komt
//   - signed_file_path = na ondertekening: pad naar de getekende kopie
export function useSignatureRequests() {
  const { user } = useAuth()
  const { project } = useProject()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRequests = useCallback(async () => {
    if (!user?.id || !project?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('signature_request_signers')
      .select(`
        id,
        status,
        viewed_at,
        signed_at,
        signed_place,
        signed_file_path,
        decline_reason,
        placement_page,
        placement_x_norm,
        placement_y_norm,
        placement_width_norm,
        placement_height_norm,
        request:signature_requests!request_id(
          id, title, description, file_path, file_name, file_size,
          file_sha256, status, due_at, created_at, project_id, org_id,
          creator:profiles!created_by(full_name)
        )
      `)
      .eq('profile_id', user.id)

    if (error) {
      logger.error('Error fetching signature requests:', error)
      setRequests([])
      setLoading(false)
      return
    }

    // Filter op huidige project (de join geeft alles binnen RLS terug).
    const scoped = (data || [])
      .filter(row => row.request?.project_id === project.id)
      .map(row => ({
        signer_id: row.id,
        request_id: row.request.id,
        title: row.request.title,
        description: row.request.description,
        file_path: row.request.file_path,
        file_name: row.request.file_name,
        file_size: row.request.file_size,
        file_sha256: row.request.file_sha256,
        request_status: row.request.status,
        due_at: row.request.due_at,
        created_at: row.request.created_at,
        org_id: row.request.org_id,
        creator_name: row.request.creator?.full_name ?? null,
        status: row.status,
        viewed_at: row.viewed_at,
        signed_at: row.signed_at,
        signed_place: row.signed_place,
        signed_file_path: row.signed_file_path,
        decline_reason: row.decline_reason,
        placement: row.placement_page ? {
          page: row.placement_page,
          x: Number(row.placement_x_norm),
          y: Number(row.placement_y_norm),
          width: Number(row.placement_width_norm),
          height: Number(row.placement_height_norm),
        } : null,
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))

    setRequests(scoped)
    setLoading(false)
  }, [user?.id, project?.id])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  return { requests, loading, refetch: fetchRequests }
}
