import { supabase } from './supabase'
import { logger } from './logger'

/**
 * Export all project data as JSON — for org admins (Art. 20/28 AVG)
 * Exports: members, posts, updates, events, documents, intake responses
 */
export async function exportProjectData(projectId, projectSlug) {
  try {
    const [members, posts, updates, events, documents, intakeResponses, intakeQuestions] = await Promise.all([
      supabase
        .from('memberships')
        .select('role, status, created_at, profile:profiles(full_name, email, phone, bio, company, website, professional_type)')
        .eq('project_id', projectId),
      supabase
        .from('posts')
        .select('*, author:profiles(full_name, email), comments:post_comments(*, author:profiles(full_name, email))')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase
        .from('updates')
        .select('*, author:profiles(full_name, email), attachments:update_attachments(*)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase
        .from('meetings')
        .select('*, rsvps:event_rsvps(*, profile:profiles(full_name, email))')
        .eq('project_id', projectId)
        .order('date', { ascending: false }),
      supabase
        .from('documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase
        .from('intake_responses')
        .select('*, profile:profiles(full_name, email)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase
        .from('intake_questions')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true }),
    ])

    const data = {
      export_info: {
        platform: 'Buuur (CrowdBuilding B.V.)',
        project: projectSlug,
        exported_at: new Date().toISOString(),
        format: 'JSON',
        note: 'Export conform AVG Art. 20 (dataportabiliteit) en Art. 28 (verwerkersovereenkomst)',
      },
      leden: (members.data || []).map(m => ({
        naam: m.profile?.full_name,
        email: m.profile?.email,
        telefoon: m.profile?.phone,
        bio: m.profile?.bio,
        bedrijf: m.profile?.company,
        website: m.profile?.website,
        type_professional: m.profile?.professional_type,
        rol: m.role,
        status: m.status,
        lid_sinds: m.created_at,
      })),
      prikbord: (posts.data || []).map(p => ({
        id: p.id,
        auteur: p.author?.full_name,
        auteur_email: p.author?.email,
        inhoud: p.content,
        type: p.type,
        aangemaakt: p.created_at,
        reacties: (p.comments || []).map(c => ({
          auteur: c.author?.full_name,
          auteur_email: c.author?.email,
          inhoud: c.content,
          aangemaakt: c.created_at,
        })),
      })),
      updates: (updates.data || []).map(u => ({
        id: u.id,
        titel: u.title,
        auteur: u.author?.full_name,
        auteur_email: u.author?.email,
        inhoud: u.content,
        type: u.type,
        gepubliceerd: u.published,
        aangemaakt: u.created_at,
        bijlagen: (u.attachments || []).map(a => ({
          naam: a.file_name,
          url: a.file_url,
          type: a.file_type,
        })),
      })),
      evenementen: (events.data || []).map(e => ({
        id: e.id,
        titel: e.title,
        beschrijving: e.description,
        datum: e.date,
        locatie: e.location,
        aanmeldingen: (e.rsvps || []).map(r => ({
          naam: r.profile?.full_name,
          email: r.profile?.email,
          status: r.status,
        })),
      })),
      documenten: (documents.data || []).map(d => ({
        id: d.id,
        naam: d.name || d.file_name,
        url: d.file_url,
        tags: d.tags,
        aangemaakt: d.created_at,
      })),
      intake_vragen: (intakeQuestions.data || []).map(q => ({
        id: q.id,
        vraag: q.question,
        type: q.type,
        volgorde: q.order_index,
        verplicht: q.required,
      })),
      intake_reacties: (intakeResponses.data || []).map(r => ({
        id: r.id,
        naam: r.profile?.full_name,
        email: r.profile?.email,
        antwoorden: r.answers,
        status: r.status,
        aangemaakt: r.created_at,
      })),
    }

    downloadJSON(data, `buuur-export-${projectSlug}-${formatDate()}`)
    return { success: true, counts: {
      leden: data.leden.length,
      prikbord: data.prikbord.length,
      updates: data.updates.length,
      evenementen: data.evenementen.length,
      documenten: data.documenten.length,
      intake_reacties: data.intake_reacties.length,
    }}
  } catch (err) {
    logger.error('Project data export failed', err)
    throw new Error('Export mislukt. Probeer het opnieuw.')
  }
}

/**
 * Export all data for a single user — for individual data portability (Art. 20 AVG)
 */
export async function exportUserData(userId) {
  try {
    const [profile, memberships, posts, comments, rsvps, intakeResponses] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single(),
      supabase
        .from('memberships')
        .select('role, status, created_at, project:projects(name, slug)')
        .eq('profile_id', userId),
      supabase
        .from('posts')
        .select('id, content, type, created_at, image_url, project:projects(name, slug)')
        .eq('author_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('post_comments')
        .select('id, content, created_at, post:posts(id, project:projects(name, slug))')
        .eq('author_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('event_rsvps')
        .select('status, created_at, meeting:meetings(title, date, project:projects(name, slug))')
        .eq('profile_id', userId),
      supabase
        .from('intake_responses')
        .select('answers, status, created_at, project:projects(name, slug)')
        .eq('profile_id', userId),
    ])

    const p = profile.data
    const data = {
      export_info: {
        platform: 'Buuur (CrowdBuilding B.V.)',
        exported_at: new Date().toISOString(),
        format: 'JSON',
        note: 'Persoonlijke data-export conform AVG Art. 20 (recht op dataportabiliteit)',
      },
      profiel: {
        naam: p?.full_name,
        email: p?.email,
        telefoon: p?.phone,
        bio: p?.bio,
        bedrijf: p?.company,
        website: p?.website,
        avatar_url: p?.avatar_url,
        type_professional: p?.professional_type,
        account_aangemaakt: p?.created_at,
      },
      lidmaatschappen: (memberships.data || []).map(m => ({
        project: m.project?.name,
        project_slug: m.project?.slug,
        rol: m.role,
        status: m.status,
        lid_sinds: m.created_at,
      })),
      berichten: (posts.data || []).map(p => ({
        id: p.id,
        project: p.project?.name,
        inhoud: p.content,
        type: p.type,
        afbeelding: p.image_url,
        aangemaakt: p.created_at,
      })),
      reacties: (comments.data || []).map(c => ({
        id: c.id,
        project: c.post?.project?.name,
        inhoud: c.content,
        aangemaakt: c.created_at,
      })),
      evenement_aanmeldingen: (rsvps.data || []).map(r => ({
        evenement: r.meeting?.title,
        datum: r.meeting?.date,
        project: r.meeting?.project?.name,
        status: r.status,
      })),
      intake_antwoorden: (intakeResponses.data || []).map(r => ({
        project: r.project?.name,
        antwoorden: r.answers,
        status: r.status,
        aangemaakt: r.created_at,
      })),
    }

    downloadJSON(data, `buuur-mijn-data-${formatDate()}`)
    return { success: true }
  } catch (err) {
    logger.error('User data export failed', err)
    throw new Error('Export mislukt. Probeer het opnieuw.')
  }
}

/**
 * Export project members as CSV — quick export for org admins
 */
export async function exportMembersCSV(projectId, projectSlug) {
  try {
    const { data, error } = await supabase
      .from('memberships')
      .select('role, status, created_at, profile:profiles(full_name, email, phone, bio, company)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (error) throw error

    const rows = (data || []).map(m => ({
      Naam: m.profile?.full_name || '',
      Email: m.profile?.email || '',
      Telefoon: m.profile?.phone || '',
      Bedrijf: m.profile?.company || '',
      Rol: m.role || '',
      Status: m.status || '',
      'Lid sinds': m.created_at ? new Date(m.created_at).toLocaleDateString('nl-NL') : '',
    }))

    downloadCSV(rows, `buuur-leden-${projectSlug}-${formatDate()}`)
    return { success: true, count: rows.length }
  } catch (err) {
    logger.error('Members CSV export failed', err)
    throw new Error('Export mislukt. Probeer het opnieuw.')
  }
}

// ── Helpers ──

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  triggerDownload(blob, `${filename}.json`)
}

function downloadCSV(rows, filename) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csvContent = [
    headers.join(';'),
    ...rows.map(row =>
      headers.map(h => {
        const val = String(row[h] ?? '').replace(/"/g, '""')
        return val.includes(';') || val.includes('"') || val.includes('\n') ? `"${val}"` : val
      }).join(';')
    ),
  ].join('\n')

  // BOM for Excel UTF-8 support
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, `${filename}.csv`)
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function formatDate() {
  return new Date().toISOString().slice(0, 10)
}
