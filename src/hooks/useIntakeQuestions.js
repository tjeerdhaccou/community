import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { logger, friendlyError } from '../lib/logger'

export default function useIntakeQuestions(projectId) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    fetchQuestions()
  }, [projectId])

  async function fetchQuestions() {
    setLoading(true)
    const { data, error } = await supabase
      .from('intake_questions')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order')
    if (error) logger.error('useIntakeQuestions.fetch', error)
    setQuestions(data || [])
    setLoading(false)
  }

  async function addQuestion(question) {
    const maxOrder = questions.reduce((max, q) => Math.max(max, q.sort_order), -1)
    const { data, error } = await supabase.from('intake_questions').insert({
      project_id: projectId,
      question_text: question.question_text,
      question_type: question.question_type || 'text',
      options: question.options || null,
      required: question.required ?? true,
      profile_field_key: question.profile_field_key || null,
      sort_order: maxOrder + 1,
    }).select().single()

    if (error) { logger.error('useIntakeQuestions.addQuestion', error); throw new Error(friendlyError(error)) }
    setQuestions(prev => [...prev, data])
    return data
  }

  async function updateQuestion(id, updates) {
    const { error } = await supabase.from('intake_questions').update(updates).eq('id', id)
    if (error) { logger.error('useIntakeQuestions.updateQuestion', error); throw new Error(friendlyError(error)) }
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q))
  }

  async function deleteQuestion(id) {
    const { error } = await supabase.from('intake_questions').delete().eq('id', id)
    if (error) { logger.error('useIntakeQuestions.deleteQuestion', error); throw new Error(friendlyError(error)) }
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  async function reorderQuestions(reordered) {
    setQuestions(reordered)
    const updates = reordered.map((q, i) => ({ id: q.id, sort_order: i }))
    for (const u of updates) {
      await supabase.from('intake_questions').update({ sort_order: u.sort_order }).eq('id', u.id)
    }
  }

  return { questions, loading, addQuestion, updateQuestion, deleteQuestion, reorderQuestions, refetch: fetchQuestions }
}
