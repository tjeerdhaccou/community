import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { logger, friendlyError } from '../lib/logger'
import { decisionError } from '../lib/decisions'

/**
 * Eén voorstel met alles wat de detailpagina nodig heeft: inhoud, tussenstand
 * (via de RPC proposal_tally, die de zichtbaarheidsregels toepast), bijlagen,
 * vragenronde en zichtbare bezwaren. Mutaties gaan via RPC's; de database
 * weigert alles wat niet mag (te laat, niet stemgerechtigd, enz.).
 */
export function useProposal(id) {
  const { user } = useAuth()
  const [proposal, setProposal] = useState(null)
  const [tally, setTally] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [questions, setQuestions] = useState([])
  const [objections, setObjections] = useState([])
  const [nextVersion, setNextVersion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!id) return
    const { data: p, error } = await supabase
      .from('proposals')
      .select(`
        *,
        workgroup:workgroups!proposals_workgroup_id_fkey(id, name, is_board),
        author:profiles!proposals_created_by_fkey(id, full_name, avatar_url)
      `)
      .eq('id', id)
      .maybeSingle()
    if (error) logger.error('useProposal.fetch', error)
    if (!p) { setNotFound(true); setLoading(false); return }
    setProposal(p)

    const [tRes, aRes, qRes, oRes, nRes] = await Promise.all([
      p.status === 'draft' ? Promise.resolve({ data: null }) : supabase.rpc('proposal_tally', { p_proposal_id: id }),
      supabase.from('proposal_attachments').select('id, file_name, file_path, file_size, file_type').eq('proposal_id', id).order('created_at'),
      supabase
        .from('proposal_questions')
        .select('id, parent_id, body, created_at, author_id, as_workgroup_id, author:profiles!proposal_questions_author_id_fkey(id, full_name, avatar_url)')
        .eq('proposal_id', id)
        .order('created_at'),
      p.form === 'consent'
        ? supabase.from('proposal_responses').select('unit_id, motivation, responded_at, overruled, overrule_reason').eq('proposal_id', id).eq('choice', 'objection')
        : Promise.resolve({ data: [] }),
      supabase.from('proposals').select('id, status, version').eq('previous_version_id', id).maybeSingle(),
    ])
    if (tRes.error) logger.error('useProposal.tally', tRes.error)
    setTally(tRes.data || null)
    setAttachments(aRes.data || [])
    setQuestions(qRes.data || [])
    setNextVersion(nRes.data || null)

    // Labels voor bezwaren (huishouden of naam) uit het kiezersbestand. RLS
    // laat alleen je eigen eenheid zien; voor de rest valt het terug op "Een lid".
    const obj = oRes.data || []
    if (obj.length) {
      const { data: units } = await supabase
        .from('proposal_electorate').select('unit_id, unit_label').eq('proposal_id', id)
        .in('unit_id', obj.map(o => o.unit_id))
      const labels = Object.fromEntries((units || []).map(u => [u.unit_id, u.unit_label]))
      setObjections(obj.map(o => ({ ...o, label: labels[o.unit_id] || null })))
    } else {
      setObjections([])
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Live: tellingen (response_count op proposals) en nieuwe vragen.
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`proposal-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'proposals', filter: `id=eq.${id}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposal_questions', filter: `proposal_id=eq.${id}` }, () => fetchAll())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, fetchAll])

  async function rpc(name, args) {
    const { data, error } = await supabase.rpc(name, args)
    if (error) {
      logger.error(`useProposal.${name}`, error)
      throw new Error(decisionError(error, friendlyError))
    }
    await fetchAll()
    return data
  }

  async function respond(choice, motivation) {
    const res = await rpc('cast_response', { p_proposal_id: id, p_choice: choice, p_motivation: motivation || null })
    window.dispatchEvent(new Event('proposals:responded'))
    return res
  }

  async function askQuestion(body) {
    const { error } = await supabase.from('proposal_questions').insert({ proposal_id: id, body: body.trim(), author_id: user.id })
    if (error) { logger.error('useProposal.ask', error); throw new Error(decisionError(error, friendlyError)) }
    await fetchAll()
  }

  async function answerQuestion(questionId, body) {
    const { error } = await supabase.from('proposal_questions').insert({
      proposal_id: id, parent_id: questionId, body: body.trim(), author_id: user.id, as_workgroup_id: proposal?.workgroup_id ?? null,
    })
    if (error) { logger.error('useProposal.answer', error); throw new Error(decisionError(error, friendlyError)) }
    await fetchAll()
  }

  async function deleteQuestion(questionId) {
    const { error } = await supabase.from('proposal_questions').delete().eq('id', questionId)
    if (error) { logger.error('useProposal.deleteQuestion', error); throw new Error(friendlyError(error)) }
    await fetchAll()
  }

  const publish = (deadline) => rpc('publish_proposal', { p_proposal_id: id, p_deadline: deadline })
  const extend = (deadline, note) => rpc('extend_proposal_deadline', { p_proposal_id: id, p_new_deadline: deadline, p_note: note })
  const withdraw = (reason) => rpc('withdraw_proposal', { p_proposal_id: id, p_reason: reason })
  const overrule = (unitId, reason) => rpc('overrule_objection', { p_proposal_id: id, p_unit_id: unitId, p_reason: reason })
  const newVersion = () => rpc('create_proposal_version', { p_proposal_id: id })

  async function loadPendingUnits() {
    const { data, error } = await supabase.rpc('proposal_pending_units', { p_proposal_id: id })
    if (error) { logger.error('useProposal.pending', error); return [] }
    return data || []
  }

  return {
    proposal, tally, attachments, questions, objections, nextVersion, loading, notFound,
    refresh: fetchAll,
    respond, askQuestion, answerQuestion, deleteQuestion,
    publish, extend, withdraw, overrule, newVersion, loadPendingUnits,
  }
}
