import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [orgMemberships, setOrgMemberships] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let currentUserId = null

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      currentUserId = session?.user?.id ?? null
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const newUserId = newSession?.user?.id ?? null
      // Skip events (TOKEN_REFRESHED on tab refocus, USER_UPDATED) where the user
      // didn't change. Otherwise `loading` flips to true and AuthGuard unmounts the
      // active subtree, destroying open modals and their form state.
      if (newUserId === currentUserId) {
        setSession(newSession)
        return
      }
      currentUserId = newUserId
      setSession(newSession)
      if (newSession?.user) {
        setLoading(true)
        loadProfile(newSession.user.id)
      } else {
        setProfile(null)
        setMemberships([])
        setOrgMemberships([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const [profileRes, membershipsRes, orgRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('memberships').select('*, projects(*)').eq('profile_id', userId),
      supabase.from('org_members').select('*, organization:organizations(*)').eq('profile_id', userId),
    ])

    setProfile(profileRes.data)
    setMemberships(membershipsRes.data || [])
    setOrgMemberships(orgRes.data || [])
    setLoading(false)
  }

  const user = session?.user ?? null
  const isPlatformAdmin = profile?.is_platform_admin ?? false
  // Org admin if user has any org_members record with role 'admin'
  const isOrgAdmin = orgMemberships.some(om => om.role === 'admin')
  // Primary org (first org membership)
  const primaryOrg = orgMemberships[0]?.organization || null
  const primaryOrgId = orgMemberships[0]?.organization_id || null
  const primaryOrgSlug = primaryOrg?.slug || primaryOrgId

  return (
    <AuthContext.Provider value={{
      user, profile, memberships, orgMemberships,
      isPlatformAdmin, isOrgAdmin, primaryOrg, primaryOrgId, primaryOrgSlug,
      loading, reload: () => user && loadProfile(user.id)
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
