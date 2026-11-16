import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'
import { canDo } from '../lib/permissions'
import { useProfessionalInvites } from '../hooks/useProfessionalInvites'
import AdviseurCard from '../components/AdviseurCard'
import InviteSheet from '../components/InviteSheet'
import ProfileEditModal from '../components/ProfileEditModal'

export default function AdviseurTeam() {
  const { project, role } = useProject()
  const { user } = useAuth()
  const { invites, createInvite, revokeInvite } = useProfessionalInvites()
  const [professionals, setProfessionals] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editProfile, setEditProfile] = useState(null)

  useEffect(() => {
    if (!project?.id) return

    async function fetchProfessionals() {
      setLoading(true)
      // Get all members of this project who have professional_type set
      const { data, error } = await supabase
        .from('memberships')
        .select('profile_id, profiles(id, full_name, avatar_url, professional_type, professional_label, company, phone, website, bio)')
        .eq('project_id', project.id)
        .not('profiles.professional_type', 'is', null)

      if (error) {
        console.error('Error fetching professionals:', error)
      } else {
        // Flatten: extract profile from each membership, add email from auth if available
        const pros = (data || [])
          .filter(m => m.profiles)
          .map(m => m.profiles)
        setProfessionals(pros)
      }
      setLoading(false)
    }

    fetchProfessionals()
  }, [project?.id])

  function handleProfileSaved(updated) {
    setProfessionals(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
    setEditProfile(null)
  }

  return (
    <div className="view-adviseur-team">
      <div className="view-header">
        <div className="view-header__row">
          <div>
            <h1>Adviseursteam</h1>
            <p className="view-header__subtitle">{professionals.length} adviseur{professionals.length !== 1 ? 's' : ''} betrokken bij dit project</p>
          </div>
          {canDo(role, 'invite_professional') && (
            <button className="btn-primary" onClick={() => setInviteOpen(true)}>
              <i className="fa-solid fa-user-plus" /> Uitnodigen
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-inline"><p>Laden...</p></div>
      ) : professionals.length === 0 ? (
        <div className="empty-inline">
          <i className="fa-solid fa-hard-hat" />
          <p>Nog geen adviseurs aan dit project gekoppeld.</p>
        </div>
      ) : (
        <div className="adviseur-grid">
          {professionals.map(pro => (
            <AdviseurCard
              key={pro.id}
              profile={pro}
              onEdit={pro.id === user?.id ? () => setEditProfile(pro) : null}
            />
          ))}
        </div>
      )}

      {inviteOpen && (
        <InviteSheet
          invites={invites}
          onInvite={createInvite}
          onRevoke={revokeInvite}
          onClose={() => setInviteOpen(false)}
        />
      )}

      {editProfile && (
        <ProfileEditModal
          profile={editProfile}
          onSave={handleProfileSaved}
          onClose={() => setEditProfile(null)}
        />
      )}
    </div>
  )
}
