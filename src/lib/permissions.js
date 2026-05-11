const ROLE_LEVELS = { guest: 0, professional: 1, aspirant: 2, member: 3, moderator: 4, admin: 5 }

const ACTION_REQUIREMENTS = {
  // Guest level — geïnteresseerd, oriënteert zich op het project
  view_public_updates: 'guest',
  view_public_docs: 'guest',
  view_public_events: 'guest',
  read_board: 'guest',          // ziet alleen public-audience posts (via RLS)
  post_on_board: 'guest',       // alleen tag 'Even voorstellen' op public audience (UI + RLS)
  manage_profile: 'guest',      // moet eigen profiel kunnen aanvullen

  // Professional level — adviseur/teamlid, beperkte toegang
  view_team: 'professional',
  view_advisor_docs: 'professional',

  // Aspirant level — geïnterviewd en betalend, krijgt interne toegang
  view_internal_updates: 'aspirant',
  view_all_docs: 'aspirant',
  view_member_profiles: 'aspirant',
  view_members_list: 'aspirant',
  view_meetings: 'aspirant',
  join_workgroup: 'aspirant',
  view_roadmap: 'aspirant',
  view_events: 'aspirant',      // alleen voor niet-public events

  // Member level — volledig lid (na betaling/acceptatie)
  // (aspirant heeft al bijna alles, members kunnen in de toekomst extra rechten krijgen)

  // Moderator level
  publish_update: 'moderator',
  create_meeting: 'moderator',
  moderate_board: 'moderator',
  invite_members: 'moderator',
  manage_workgroups: 'moderator',
  record_decisions: 'moderator',
  invite_professional: 'moderator',
  manage_intake: 'moderator',
  manage_settings: 'moderator',

  // Admin level
  edit_settings: 'admin',
  assign_roles: 'admin',
  edit_phases: 'admin',
  set_branding: 'admin',
  remove_members: 'admin',
}

export function canDo(userRole, action) {
  const required = ACTION_REQUIREMENTS[action]
  if (!required) return false
  return (ROLE_LEVELS[userRole] || 0) >= ROLE_LEVELS[required]
}
