/**
 * Admin-zicht op nieuwsbriefleads en hun Brevo-synchronisatie.
 *
 * Elke lead staat altijd in Neon; de Brevo-dispatch kan falen (verkeerde
 * lijst-ID, sleutel verlopen, rate limit). Deze module toont per inschrijver
 * de laatste sync-status en laat een admin een gefaalde sync opnieuw duwen.
 */
import { sql } from "@/lib/neon";

const BREVO_CONTACTS = "https://api.brevo.com/v3/contacts";

export type NewsletterSyncStatus = "synced" | "failed" | "pending" | "skipped";

export interface NewsletterSubscriberRow {
  id: string;
  handle: string;
  email: string;
  source: string;
  listId: number | null;
  syncedAt: string | null;
  error: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
  status: NewsletterSyncStatus;
}

type Row = Record<string, unknown>;

function toStatus(row: Row): NewsletterSyncStatus {
  if (row["brevo_error"]) return "failed";
  if (row["brevo_synced_at"]) return "synced";
  if (!row["brevo_list_id"]) return "skipped";
  return "pending";
}

function mapRow(row: Row): NewsletterSubscriberRow {
  const listId = row["brevo_list_id"];
  return {
    id: String(row["id"]),
    handle: String(row["handle"]),
    email: String(row["email"]),
    source: String(row["source"] ?? "profile"),
    listId: listId == null ? null : Number(listId),
    syncedAt: row["brevo_synced_at"]
      ? new Date(row["brevo_synced_at"] as string).toISOString()
      : null,
    error: row["brevo_error"] ? String(row["brevo_error"]) : null,
    unsubscribedAt: row["unsubscribed_at"]
      ? new Date(row["unsubscribed_at"] as string).toISOString()
      : null,
    createdAt: new Date(row["created_at"] as string).toISOString(),
    status: toStatus(row),
  };
}

export interface NewsletterOverview {
  rows: NewsletterSubscriberRow[];
  counts: { total: number; synced: number; failed: number; pending: number; skipped: number };
  brevoConfigured: boolean;
}

export async function fetchNewsletterSubscribers(opts: {
  search?: string;
  onlyFailed?: boolean;
  limit?: number;
}): Promise<NewsletterOverview> {
  const search = (opts.search ?? "").trim().toLowerCase();
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const like = `%${search}%`;

  const rows = (await sql`
    select *
      from public.newsletter_subscribers
     where (${search} = '' or lower(email) like ${like} or lower(handle) like ${like})
       and (${opts.onlyFailed ?? false} = false or brevo_error is not null)
     order by (brevo_error is not null) desc, created_at desc
     limit ${limit}
  `) as Row[];

  const totals = (await sql`
    select
      count(*)::int as total,
      count(*) filter (where brevo_error is not null)::int as failed,
      count(*) filter (where brevo_error is null and brevo_synced_at is not null)::int as synced,
      count(*) filter (where brevo_error is null and brevo_synced_at is null and brevo_list_id is not null)::int as pending,
      count(*) filter (where brevo_error is null and brevo_synced_at is null and brevo_list_id is null)::int as skipped
    from public.newsletter_subscribers
  `) as Row[];

  const c = totals[0] ?? {};
  return {
    rows: rows.map(mapRow),
    counts: {
      total: Number(c["total"] ?? 0),
      synced: Number(c["synced"] ?? 0),
      failed: Number(c["failed"] ?? 0),
      pending: Number(c["pending"] ?? 0),
      skipped: Number(c["skipped"] ?? 0),
    },
    brevoConfigured: Boolean(process.env["BREVO_API_KEY"]),
  };
}

/** Duwt één (of alle gefaalde) inschrijving(en) opnieuw naar Brevo. */
export async function retryNewsletterSync(opts: {
  id?: string;
  allFailed?: boolean;
}): Promise<{ attempted: number; synced: number; failed: number; message: string }> {
  const key = process.env["BREVO_API_KEY"];
  if (!key) {
    return { attempted: 0, synced: 0, failed: 0, message: "BREVO_API_KEY ontbreekt." };
  }

  const rows = (
    opts.allFailed
      ? await sql`
        select * from public.newsletter_subscribers
         where brevo_error is not null and unsubscribed_at is null
         order by created_at desc limit 200
      `
      : await sql`
        select * from public.newsletter_subscribers where id = ${opts.id ?? null} limit 1
      `
  ) as Row[];

  let synced = 0;
  let failed = 0;

  for (const row of rows) {
    const email = String(row["email"]);
    const handle = String(row["handle"]);
    const listId = row["brevo_list_id"] == null ? null : Number(row["brevo_list_id"]);
    if (!listId) {
      await sql`
        update public.newsletter_subscribers
           set brevo_error = 'Geen Brevo-lijst ingesteld op het profielblok.', updated_at = now()
         where id = ${String(row["id"])}
      `.catch(() => undefined);
      failed += 1;
      continue;
    }

    let ok = false;
    let detail = "";
    try {
      const res = await fetch(BREVO_CONTACTS, {
        method: "POST",
        headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          email,
          listIds: [listId],
          updateEnabled: true,
          attributes: { ROUT_HANDLE: handle },
        }),
      });
      detail = res.ok || res.status === 204 ? "" : (await res.text().catch(() => "")).slice(0, 200);
      ok = res.ok || res.status === 204 || detail.includes("duplicate_parameter");
      if (!ok && !detail) detail = `HTTP ${res.status}`;
    } catch (error) {
      detail = error instanceof Error ? error.message.slice(0, 200) : "netwerkfout";
    }

    await sql`
      update public.newsletter_subscribers
         set brevo_synced_at = ${ok ? new Date().toISOString() : null},
             brevo_error = ${ok ? null : detail},
             updated_at = now()
       where id = ${String(row["id"])}
    `.catch(() => undefined);

    if (ok) synced += 1;
    else failed += 1;
  }

  return {
    attempted: rows.length,
    synced,
    failed,
    message: rows.length
      ? `${synced} gesynchroniseerd, ${failed} mislukt.`
      : "Niets om opnieuw te proberen.",
  };
}
