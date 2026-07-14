# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on http://localhost:5190
npm run build        # Production build (outputs to dist/)
npm run preview      # Preview production build
```

No test runner or linter configured.

## Tech Stack

- React 19 + Vite 6 (port 5190, strict)
- Supabase (Frankfurt region) — Auth, Database, Storage, Realtime
- Font Awesome 6 icons
- CSS variables from Clean DS tokens (no CSS-in-JS, no Tailwind)
- All UI text is in Dutch

## Architecture

### Subdomain Routing (App.jsx)

The app uses a hybrid path + subdomain routing system. `SubdomainRouter` is the entry point:

1. **No subdomain** (`buuur.nl`) — Path-based routing:
   - Public: `/login`, `/intake/:projectId`, `/project/:slug`, `/auth/callback`
   - Org-level: `/org/:orgSlug`, `/org/:orgSlug/settings`
   - Project-level: `/p/:slug/updates`, `/p/:slug/community`, etc.

2. **Project subdomain** (`vlinderhaven.buuur.nl`) — `SubdomainLookup` does a DB query to check if slug matches a project. Routes directly to project views without `/p/:slug` prefix.

3. **Org subdomain** (`commoncity.buuur.nl`) — `SubdomainLookup` checks if slug matches an org. Redirects to `/admin` for the org dashboard.

`SubdomainLookup` queries both `projects` and `organizations` tables by slug to determine which type.

### Cross-Subdomain Auth

localStorage is domain-scoped, so Supabase sessions don't transfer between subdomains. Two mechanisms solve this:

**OAuth flow** (Google login from subdomain):
1. `signInWithGoogle()` in `src/lib/auth.js` saves return URL in a cookie on `.buuur.nl` (shared across all subdomains)
2. OAuth always redirects to main domain (`buuur.nl/auth/callback`)
3. `AuthCallback` reads cookie, gets session tokens, redirects to subdomain via: `olga.buuur.nl/auth/callback#access_token=...&refresh_token=...&returnPath=/`
4. Subdomain's `AuthCallback` calls `supabase.auth.setSession()` to restore session

**Direct navigation** (clicking project card in org dashboard):
- Use `navigateToSubdomain(targetUrl)` from `src/lib/subdomain.js`
- Gets current session tokens and passes them via URL hash to target subdomain's `/auth/callback`
- **Never use `window.location.href` or `navigate()` for cross-subdomain links** — always use `navigateToSubdomain()`

### Subdomain-Aware URL Helpers

Always use these helpers from `src/lib/subdomain.js` instead of hardcoding URLs:

- `getProjectBaseUrl(project)` — Returns `https://slug.buuur.nl` if custom_domain set, else `https://buuur.nl/p/slug`
- `getIntakeUrl(project)` — Returns `https://slug.buuur.nl/intake` or `https://buuur.nl/intake/:id`
- `getPublicSiteUrl(project)` — Returns `https://slug.buuur.nl/public` or `https://buuur.nl/project/:slug`
- `navigateToSubdomain(url)` — Cross-subdomain navigation with session transfer

### Contexts

- **AuthContext** — User session, profile, memberships, orgMemberships, `isPlatformAdmin`, `isOrgAdmin`, `primaryOrgSlug`. Provides `reload()` to refresh after changes.
- **ProjectContext** — Current project, membership, computed `role`. Auto-creates admin membership for org admins on first visit. Wraps all `/p/:slug/*` routes.
- **ThemeContext** — Light/dark mode with per-project branding colors.

### Role Hierarchy

```
interested(-1) → guest(0) → professional(1) → aspirant(2) → member(3) → moderator(4) → admin(5)
```

- `professional`: Team-only role for adviseurs — sees Dashboard, Updates (public only), Events, Documents (adviseur tag), Team
- `aspirant`: Prospective member — sees most content, no moderation
- `moderator`: Can publish updates, manage intake, invite members, moderate board
- `admin`: Full project control (settings, roles, branding, phases)
- **Org admins** get implicit admin access to all org projects. `ProjectContext` auto-creates a physical admin membership on first visit, and `has_membership()` SQL function has an OR clause for org admin access.

Permission checks: `canDo(role, action)` in `src/lib/permissions.js`. Actions map to minimum role levels.

### Data Hooks Pattern

All hooks in `src/hooks/` follow this structure:

```javascript
export function useX() {
  const { project } = useProject()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => { /* supabase query */ }, [project?.id])

  useEffect(() => { fetch() }, [fetch])               // initial fetch
  useEffect(() => { /* realtime subscription */ }, []) // live updates

  async function create(data) { /* insert + throw friendlyError on fail */ }
  async function update(id, data) { /* update */ }
  async function remove(id) { /* delete */ }

  return { items, loading, create, update, remove }
}
```

Key conventions:
- Fetch errors: `logger.error()` only (don't throw — let UI show empty state)
- CRUD errors: `logger.error()` + `throw new Error(friendlyError(error))` — callers show toast
- Realtime: subscribe to Supabase channel, call `fetch()` on changes, cleanup on unmount

### Error Handling

- `src/lib/logger.js` — Wraps console in dev, sends to Sentry in prod. `friendlyError(err)` maps Supabase errors to Dutch user messages.
- `src/components/ErrorBoundary.jsx` — Wraps entire app, catches React render errors.
- Toast system via `useToast()` context — call `toast.error(message)` or `toast.success(message)`.

### File Uploads

`src/lib/storage.js`:
- `uploadImage(file, bucket)` — Compresses to max 1200px JPEG, uploads to Supabase Storage
- `uploadFile(file, bucket)` — Validates extension whitelist + 10MB size limit
- Buckets: `post-images`, `project-files`, `avatars`

### Domain Automation

`supabase/functions/setup-project-domain/index.ts` — Edge function called when a project is created:
1. Adds CNAME record to TransIP DNS (`slug.buuur.nl → cname.vercel-dns.com.`)
2. Registers domain in Vercel project (auto SSL)
3. Updates `projects.custom_domain` in database

Triggered from `NewProjectCard.jsx` after project insert. Requires Supabase secrets: `TRANSIP_PRIVATE_KEY`, `TRANSIP_LOGIN`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `MAIN_DOMAIN`.

### Supabase / RLS

- All tables have RLS enabled with policies using helper functions: `is_platform_admin()`, `has_membership(project_id, min_role)`, `is_org_admin(org_id)`
- `has_membership()` grants org admins implicit access via OR clause (no physical membership row needed)
- Migrations are in `supabase/migrations/` — apply via the Supabase MCP (`apply_migration` on project `czgsqmbejsmcjusigwhp` = "Community", eu-central-1). Fallback: SQL Editor.

## Design System: Clean DS

All styling MUST follow the Clean Design System. Full token reference: `CLEAN-DS-TOKENS.md`.

Core rules:
- **Shadows over borders** — cards defined by shadow depth, NEVER visible borders
- **Color is earned** — only for status, data, active nav, CTAs. Never decorative.
- **Max 3 accent colors per view**
- **Whitespace is intentional** — don't fill it
- Always use CSS variables (`var(--token-name)`), never hardcoded values
- Hover: `translateY(-1px)` + shadow lift, 150ms. No hover on mobile.
- Tags: 14% opacity background, darker text (see CLEAN-DS-TOKENS.md)
- Modal detail actions: top-right corner, 32×32px icon buttons, close always rightmost
- All create/edit modals: `max-width: 720px`
- Danger buttons: `--accent-red`, never pink

## Conventions

- Components in `src/components/`, views in `src/views/`, hooks in `src/hooks/`
- Shared constants (roles, tag colors, time formatting) in `src/lib/constants.js`
- All new views: add to max-width list in `index.css`
- `safeStorage.js` for localStorage (try/catch for private browsing)
- Confirm destructive actions with `ConfirmModal` before executing
- Cross-subdomain links: always use `navigateToSubdomain()`, never `window.location.href`
- Project URLs: always use `getProjectBaseUrl()` / `getIntakeUrl()` / `getPublicSiteUrl()`
- Org URLs: use `primaryOrgSlug` from AuthContext, never raw UUIDs
