import { canDo } from './permissions'

/**
 * Eén bron voor de projectnavigatie: de sidebar (desktop) en de onderbalk +
 * "Meer"-sheet (mobiel) lezen allebei hieruit, zodat zichtbaarheid (rol,
 * module-toggles, professional-only) nooit uit de pas loopt.
 */
export const NAV_SECTIONS = [
  {
    items: [
      { to: '', icon: 'fa-solid fa-house', color: 'var(--clean-inbox, #4A90D9)', bubble: 'navy', label: 'Dashboard', shortLabel: 'Home', end: true },
    ]
  },
  {
    // Persoonlijke acties bovenaan — dit is voor het lid de belangrijkste hub
    // (tekenverzoeken, documentverzoeken, klaargezette bestanden) en verdient
    // 1-click bereikbaarheid, niet weggemoffeld als tab in Documenten.
    label: 'Voor jou',
    items: [
      { to: 'mijn-dossier', icon: 'fa-solid fa-file-shield', color: '#2BAFA0', bubble: 'navy', label: 'Mijn dossier', shortLabel: 'Dossier', membersOnly: true },
      // Chat: support + ledenchat (1-op-1 en thema-groepen) op één pagina.
      { to: 'chat', icon: 'fa-solid fa-comments', color: 'var(--clean-anytime, #3BD269)', bubble: 'green', label: 'Chat' },
    ]
  },
  {
    label: 'Actueel',
    items: [
      { to: 'updates', icon: 'fa-solid fa-bullhorn', color: 'var(--clean-today, #F4B400)', bubble: 'coral', label: 'Projectnieuws', shortLabel: 'Nieuws', feature: 'updates' },
      { to: 'community', icon: 'fa-solid fa-thumbtack', color: '#E4572E', bubble: 'green', label: 'Prikbord', action: 'read_board', membersOnly: true, feature: 'board' },
      { to: 'events', icon: 'fa-solid fa-calendar-check', color: 'var(--clean-upcoming, #F09020)', bubble: 'amber', label: 'Events', feature: 'events' },
    ]
  },
  {
    label: 'Project',
    items: [
      { to: 'roadmap', icon: 'fa-solid fa-road', color: '#5B6BD6', bubble: 'periwinkle', label: 'Roadmap', action: 'view_roadmap', membersOnly: true, feature: 'roadmap' },
      // Library only: projectdocumenten + adviseur-documenten. Eigen bestanden
      // staan onder "Mijn dossier".
      { to: 'documenten', icon: 'fa-solid fa-folder-open', color: '#9B59B6', bubble: 'pink', label: 'Projectdossier', membersOnly: true },
    ]
  },
  {
    label: 'Community',
    items: [
      // Leden bundelt de ledenlijst + ledenwerving (werving-tab alleen voor moderators+).
      { to: 'members', icon: 'fa-solid fa-users', color: '#F23578', bubble: 'peach', label: 'Leden', action: 'view_members_list', feature: 'members' },
      // Organisatie bundelt Team (adviseurs) + Groepen/commissies.
      {
        to: 'organisatie', icon: 'fa-solid fa-people-group', color: '#C9A96E', bubble: 'navy', label: 'Organisatie',
        visible: (ctx) => (canDo(ctx.role, 'view_team') && ctx.featureEnabled('team')) || canDo(ctx.role, 'manage_workgroups'),
      },
    ]
  },
  {
    label: 'Beheer',
    collapsible: true,
    items: [
      { to: 'aan-de-slag', icon: 'fa-solid fa-rocket', color: 'var(--accent-green, #3BD269)', bubble: 'green', label: 'Aan de slag', adminOnly: true, visible: (ctx) => ctx.role === 'admin' && ctx.onboardingActive },
      { to: 'page-builder', icon: 'fa-solid fa-wand-magic-sparkles', color: 'var(--accent-purple, #7B5EA7)', bubble: 'teal', label: 'Pagina bouwer', adminOnly: true, feature: 'page_builder' },
      { to: 'settings', icon: 'fa-solid fa-gear', color: 'var(--text-tertiary)', bubble: 'neutral', label: 'Instellingen', adminOnly: true },
    ]
  },
]

/** Account staat niet in de sidebar (daar zit het in het gebruikersmenu), wel in de mobiele "Meer"-sheet. */
export const ACCOUNT_ITEM = { to: 'profile', icon: 'fa-solid fa-circle-user', color: 'var(--text-tertiary)', bubble: 'neutral', label: 'Account' }

/**
 * Volgorde van voorkeur voor de vaste plekken in de onderbalk (mobiel). De
 * eerste vier zichtbare items komen in de balk, de rest onder "Meer". Chat
 * staat hoog: dat is waar leden het vaakst terugkomen.
 */
export const MOBILE_PRIMARY_ORDER = ['', 'chat', 'updates', 'community', 'events', 'mijn-dossier', 'members']

/** Zelfde regels als de sidebar: rol, professional-only, admin-only, module-toggles, custom `visible`. */
export function isNavItemVisible(item, ctx) {
  const { role, featureEnabled, onboardingActive } = ctx
  if (item.visible) return item.visible({ role, featureEnabled, onboardingActive })
  if (item.membersOnly && role === 'professional') return false
  if (item.adminOnly && role !== 'admin') return false
  if (item.action && !canDo(role, item.action)) return false
  // Uitgezette modules zijn voor iederéén verborgen, ook voor admins.
  if (item.feature && !featureEnabled(item.feature)) return false
  return true
}

/** Alle zichtbare items, plat, in sidebar-volgorde. */
export function visibleNavItems(ctx) {
  return NAV_SECTIONS.flatMap((s) => s.items.filter((i) => isNavItemVisible(i, ctx)))
}
