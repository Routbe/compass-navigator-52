/** Server-only: social accounts claimed by a workspace. Editors manage, members read. */
import { sql } from "@/lib/neon";
import { canRefresh, isSocialPlatform, normalizeSocialUsername, type SocialLinkDTO, type SocialPlatform } from "@/lib/social-verify";
import { canEditWorkspaceHub } from "./workspace-rules";
import { getWorkspaceRole, isUuid } from "./workspaces.server";
import { bioProvesWorkspace } from "./workspace-social-rules";

type Row = Record<string, unknown>;
const COLS = "id, platform, username, is_verified, follower_count, last_synced_at, verified_at, last_error";

const iso = (v: unknown) => (!v ? null : v instanceof Date ? v.toISOString() : String(v));
function toDTO(r: Row): SocialLinkDTO {
  return {
    id: r["id"] as string,
    platform: r["platform"] as SocialPlatform,
    username: r["username"] as string,
    isVerified: Boolean(r["is_verified"]),
    followerCount: (r["follower_count"] as number | null) ?? null,
    lastSyncedAt: iso(r["last_synced_at"]),
    verifiedAt: iso(r["verified_at"]),
    lastError: (r["last_error"] as string | null) ?? null,
  };
}

async function assertRole(userId: string, workspaceId: string, edit: boolean) {
  if (!isUuid(workspaceId)) throw new Error("Forbidden");
  const role = await getWorkspaceRole(userId, workspaceId);
  if (!role || (edit && !canEditWorkspaceHub(role))) throw new Error("Forbidden");
}

export async function readWorkspaceProofTarget(workspaceId: string) {
  const rows = (await sql`
    select slug, case when domain_verified_at is not null then domain end as domain
      from public.workspaces where id = ${workspaceId} limit 1
  `) as Row[];
  const r = rows[0];
  return r ? { slug: r["slug"] as string, domain: (r["domain"] as string | null) ?? null } : null;
}

export async function listWorkspaceSocial(userId: string, workspaceId: string) {
  await assertRole(userId, workspaceId, false);
  const target = await readWorkspaceProofTarget(workspaceId);
  const rows = (await sql.query(
    `select ${COLS} from public.workspace_social_links where workspace_id = $1 order by created_at asc`,
    [workspaceId],
  )) as Row[];
  return { links: rows.map(toDTO), slug: target?.slug ?? "", domain: target?.domain ?? null };
}

export async function upsertWorkspaceSocial(userId: string, workspaceId: string, platformRaw: string, usernameRaw: string) {
  await assertRole(userId, workspaceId, true);
  if (!isSocialPlatform(platformRaw)) throw new Error("platform_invalid");
  const username = normalizeSocialUsername(platformRaw, usernameRaw);
  if (!username || username.length > 120) throw new Error("username_invalid");
  const rows = (await sql`
    insert into public.workspace_social_links (workspace_id, platform, username, created_by)
    values (${workspaceId}, ${platformRaw}, ${username}, ${userId})
    on conflict (workspace_id, platform) do update set
      username = excluded.username,
      is_verified = case when public.workspace_social_links.username = excluded.username then public.workspace_social_links.is_verified else false end,
      verified_at = case when public.workspace_social_links.username = excluded.username then public.workspace_social_links.verified_at else null end,
      updated_at = now()
    returning id, platform, username, is_verified, follower_count, last_synced_at, verified_at, last_error
  `) as Row[];
  return toDTO(rows[0]!);
}

export async function deleteWorkspaceSocial(userId: string, workspaceId: string, id: string) {
  await assertRole(userId, workspaceId, true);
  await sql`delete from public.workspace_social_links where id = ${id} and workspace_id = ${workspaceId}`;
  return { ok: true as const };
}

export async function verifyWorkspaceSocial(userId: string, workspaceId: string, id: string) {
  await assertRole(userId, workspaceId, true);
  const rows = (await sql`
    select id, platform, username, is_verified, follower_count, last_synced_at, verified_at, last_error
      from public.workspace_social_links where id = ${id} and workspace_id = ${workspaceId} limit 1
  `) as Row[];
  if (!rows[0]) return { ok: false, reason: "not_found" as const, link: null };
  const link = toDTO(rows[0]);
  if (link.isVerified && !canRefresh(link.lastSyncedAt)) return { ok: true, reason: "verified" as const, link };
  const target = await readWorkspaceProofTarget(workspaceId);
  if (!target) return { ok: false, reason: "not_found" as const, link };
  const { fetchSnapshot } = await import("./social-verify.server");
  let bio = "";
  let followers: number | null = null;
  try {
    const snap = await fetchSnapshot(link.platform, link.username);
    bio = snap.bio;
    followers = snap.followerCount;
  } catch {
    await sql`update public.workspace_social_links set last_error = 'fetch_failed', last_synced_at = now() where id = ${id}`;
    return { ok: false, reason: "fetch_failed" as const, link };
  }
  const ok = bioProvesWorkspace(bio, target.slug, target.domain);
  const saved = (await sql`
    update public.workspace_social_links
       set is_verified = ${ok},
           follower_count = coalesce(${followers}, follower_count),
           verified_at = case when ${ok} then coalesce(verified_at, now()) else null end,
           last_synced_at = now(),
           last_error = ${ok ? null : "link_missing"}
     where id = ${id} and workspace_id = ${workspaceId}
    returning id, platform, username, is_verified, follower_count, last_synced_at, verified_at, last_error
  `) as Row[];
  return { ok, reason: ok ? ("verified" as const) : ("link_missing" as const), link: saved[0] ? toDTO(saved[0]) : link };
}
