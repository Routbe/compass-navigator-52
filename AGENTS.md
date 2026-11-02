<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Repository import
- Preserve the imported ROUT source structure, route handlers and design; this is a source import, not a website capture.
- Keep the managed TanStack Start and Cloudflare configuration; MDX catalog plugins are required by the imported documentation.
- Retain the imported Better Auth cookie-session architecture until explicitly migrated; Cloud connection alone does not configure the original database or external services.
- Do not apply imported database scripts automatically; they require review against the target service and existing schema.
- Subdirectories may have their own AGENTS.md; read those rules before changing their files.
- Bio assistance uses pure browser-safe helpers and updates the Studio draft through its existing callback; only the existing explicit persistence path saves data, so formatting never writes automatically or fabricates translated text.
- Contact triage remains deterministic behind the existing staff permission boundary; local helpers and tests must not depend on external AI SDKs or provider credentials.
- Authentication configuration readiness is checked before challenges, mail and passkeys, and shared with the sign-in UI; this detects missing configuration without replacing Better Auth or bypassing its safety checks.
- Static images and icons stay as real files in `public/` and `src/assets/`, not externalized pointers. Why: the app is also deployed outside Lovable (Vercel), where Lovable-hosted asset paths do not exist.
- Deferred `sql` queries capture the database context at creation time (`src/lib/neon.ts`). Why: `withDbContext(ctx, () => sql\`...\`)` is awaited after the context ends; losing it broke the post-sign-in account link.
- The official bunny logo shape lives in `public/logo.svg` and `src/assets/rout-logo.svg` (identical files, traced from the press kit icon); header/footer render it via CSS mask in `RoutLogo`. Why: the brand kit shape is canonical — never substitute a different tracing.
- Contact portal categories (general/business/partner/bug) seed the local triage; bug attachments upload anonymously via `/api/public/contact/attachment` into the internal bucket under `contact/`, validated by `src/lib/contact-attachments.ts` (extension + magic bytes, 5 MiB). Why: anonymous upload must stay narrow and content-sniffed.
- One identity, one main URL: the member's @ preference (`profiles.url_style`, binary via `urlStyleHasAt`/`urlStyleForAtPreference` in `src/lib/profile-url.ts`) decides the main shape; every other shape 301-redirects server-side via `rootRedirectFor`/`aliasRedirectFor` in the `$username` and `u.$username` loaders. Why: no two profile pages may ever exist for the same person. The Studio has two separate canvases behind a switcher at the top: Privacy Alias (`/u/<alias>`, `alias_profiles`, default) and Verified Profile (`/<handle>`, `profiles`, locked until verified); `ProfileEditor` is keyed by variant so content, design and blocks never mix.
- Next.js concepts map onto TanStack Start here: route groups = pathless layouts (`_authenticated` is the OS/auth group; every route is code-split automatically), `middleware.ts` = route loaders/server handlers, edge runtime = the Cloudflare Worker that already runs all server code. Why: the stack is fixed; never add Next.js files.
- `/` redirects signed-in members to `/dashboard` in its loader via `getGatewaySession` (never on a member's own domain). Why: the cockpit is a member's root and the redirect must happen before marketing HTML renders.
- Omni-Bar routing rules live in the pure `src/lib/omni-parser.ts` (tested); only http(s) URLs reach the Studio generator. Why: one parser for hint and submit, no unsafe schemes.
- Cockpit state is local-first via `useLocalFirst` + IndexedDB snapshots keyed by user id and cleared on sign-out. Why: instant paint without leaving private data on shared devices.
- Short-link resolves use the isolate cache in `src/lib/edge-link-cache.ts` (15 s TTL, `LinkCacheStore` seam for a shared KV). Why: repeat scans skip database lookups while repoints still apply within seconds.
- `identity_relays` is the relay registry; `ensureForwardingAddress` writes it and `oauth_email_forwarding_rules` stays the delivery authority, changed together in `identity-relays.server.ts`. Why: apps see only the proxy and the target follows the primary address, so email changes need no push.
- Optimistic mutations go through the persisted outbox (`src/lib/local-first/outbox.ts`, last write per relay wins; network errors retry, rejections roll back via refetch). Why: 0 ms UI without losing changes offline.
- `rout_app` is DML-only (0158): no TRUNCATE/REFERENCES/TRIGGER, no CREATE on schemas or database, no TEMP, owns nothing; 0158 aborts if the role ever gains elevated attributes. New tables must grant rout_app explicitly in their own migration. Why: a leaked runtime credential can change rows under RLS but never the schema.
- Account merge keeps the primary's identity relay per app; secondary duplicates go to `identity_relay_merge_archive` (read-only for members) and a warning notification. Why: no silent loss of a proxy address and no two relays for one app.
- Page titles are branded centrally: routes write short titles and `BrandedHeadContent` (via `brandHeadTags` in `src/lib/page-title.ts`) renders `PageName | <brand>`; ROUT's Schema.org graph lives once in `src/lib/knowledge-graph.ts`, injected from `__root`. Member pages (og:type profile) keep their own title and never carry ROUT's graph. Why: one convention no route can drift from, and a member's identity is not ROUT's.
- Studio saves are atomic section patches (`updateProfileMeta` / `updateProfileTheme` / `updateProfileLinks` in `src/lib/profile-draft.functions.ts`, diffed by `src/lib/profile-draft-patch.ts`, merged in SQL by `patch_profile_draft`) bound to an explicit `space`; draft JSON passes `toDraftJson` before validation. Why: a change in one section must never fail on another section's nested data, and the two canvases must never overwrite each other.
- Agent access lives in `src/lib/agent/`: agent scopes (`agent-scopes.ts`) ride only on human-delegated OAuth access tokens capped at 1 h, never on API keys or client_credentials; agent routes (`/api/agent/*`) call `authenticateAgent` per request and answer with the shared `responses.ts` shapes (202 `human_action_required` + signed `/act` ticket, 402 `upgrade_url`). Why: agents act only for a consenting human, visibly and revocably, and LLMs can relay every refusal to the user.
- Profile URLs answer JSON-LD to explicit JSON requests and user-triggered AI fetchers via `machineProfileMiddleware` (`lib/agent/content-negotiation.ts`), reusing the public reads and redaction of the HTML page. Why: one source of public truth; search crawlers keep the HTML.

- Repository imports preserve this project’s generated Cloud clients and project identity; source backend credentials and SQL are never copied or applied automatically. Why: imported services belong to a different deployment.
- Workspace icons: `workspaces.icon` holds a key from the fixed set in `src/lib/workspace-icons.ts` (NULL = derive from category); uploaded logos stay in `avatar_url`. Why: never mix icon keys into image URLs that the Studio uses as avatar.
- Personal→workspace conversion carries username-derived slug (or chosen), Studio designs (`pickConversionDesign`: verified live, other as concept) and the verified domain; old personal addresses 302 to `/w/<slug>` via `rout_migrated_workspace_for_handle` during the sunset only. Why: nothing is lost and the old name frees up after 30 days.
- Personal accounts never use a verified domain as username (served on the domain itself); only workspaces may. Why: one identity per address.
- The global Cmd/Ctrl+K command palette (`src/components/CommandPalette.tsx`) is mounted once in `__root` and opened elsewhere via the `rout:command-palette` window event. Why: one command center on every route, no duplicate listeners.
- The remote MCP server is `/api/mcp` (`src/routes/api_.mcp.ts` + pure `src/lib/mcp-server/protocol.ts`); write tools delegate to the `/api/agent/*` handlers instead of reimplementing them. Why: ROUT uses its own OAuth/agent scopes (not Supabase auth), and scope checks, quotas, Chronos audit and human_action_required must stay in one place.
