import { supabase } from './supabase'
import { logger } from './logger'

// Centraal aanroeppunt voor activity notifications.
// Best-effort: faalt stil zodat een misgaande mail nooit de gebruikersactie blokkeert.
//
// Types: 'new_update' | 'new_event' | 'new_document' | 'new_post'
//      | 'new_comment' | 'new_reply' | 'new_update_comment'
//      | 'document_request' | 'document_request_submitted'
export async function dispatchNotification({ projectId, type, referenceId, actorId }) {
  if (!projectId || !type || !referenceId) {
    logger.warn('dispatchNotification', 'Missing required args')
    return
  }
  try {
    const { error } = await supabase.functions.invoke('dispatch-notification', {
      body: {
        project_id: projectId,
        type,
        reference_id: referenceId,
        actor_id: actorId || null,
      },
    })
    if (error) logger.error('dispatchNotification', error)
  } catch (err) {
    logger.error('dispatchNotification', err)
  }
}
