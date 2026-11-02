/**
 * Brevo-nieuwsbriefinschrijving voor profielwidgets.
 *
 * De widget op een publiek profiel stuurt alleen een e-mailadres en het
 * handle. De lijst-ID komt uit de blokwaarde van de maker, en het adres wordt
 * server-side gevalideerd voordat het naar Brevo gaat.
 */
import { sql } from "@/lib/neon";

type Row = Record<string, unknown>;

const BREVO_CONTACTS = "https://api.brevo.com/v3/contacts";

interface Block {
  kind?: string;
  value?: string;
  hidden?: boolean;
}

/**
 * Leest de nieuwsbrieflijst die de maker zelf heeft ingesteld. We vertrouwen
 * nooit een lijst-ID uit de browser: alleen wat in het profiel staat telt.
 */
export async function newsletterListFor(handle: string): Promise<number | null> {
  const rows = (await sql`
    select blocks from public.profiles where username = ${handle.toLowerCase()} limit 1
  `) as Row[];
  const blocks = (rows[0]?.["blocks"] ?? []) as Block[];
  if (!Array.isArray(blocks)) return null;
  const block = blocks.find((b) => b?.kind === "newsletter" && !b.hidden && b.value);
  if (!block?.value) return null;
  const id = Number.parseInt(String(block.value).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Bewaart de lead eerst in Neon (idempotent per handle+e-mail) en stuurt hem
 * daarna optioneel door naar Brevo. Zonder Brevo-configuratie blijft de
 * inschrijving gewoon geldig — de maker houdt zijn lijst.
 */
export async function subscribeToNewsletter(params: {
  handle: string;
  email: string;
}): Promise<{ ok: boolean; message: string }> {
  const handle = params.handle.toLowerCase();
  const listId = await newsletterListFor(handle);

  let existed = false;
  try {
    const rows = (await sql`
      insert into public.newsletter_subscribers (handle, email, brevo_list_id)
      values (${handle}, ${params.email}, ${listId})
      on conflict (handle, email) do update set
        unsubscribed_at = null,
        brevo_list_id = coalesce(excluded.brevo_list_id, public.newsletter_subscribers.brevo_list_id),
        updated_at = now()
      returning (xmax <> 0) as existed
    `) as Row[];
    existed = rows[0]?.["existed"] === true;
  } catch (error) {
    console.error("[newsletter] kon de inschrijving niet bewaren", error);
    return { ok: false, message: "Inschrijven lukte niet. Probeer het later opnieuw." };
  }

  const key = process.env["BREVO_API_KEY"];
  if (!key || !listId) {
    return {
      ok: true,
      message: existed ? "Je stond al ingeschreven." : "Je bent ingeschreven.",
    };
  }

  const res = await fetch(BREVO_CONTACTS, {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      email: params.email,
      listIds: [listId],
      updateEnabled: true,
      attributes: { ROUT_HANDLE: handle },
    }),
  });

  const detail =
    res.ok || res.status === 204 ? "" : (await res.text().catch(() => "")).slice(0, 200);
  const synced = res.ok || res.status === 204 || detail.includes("duplicate_parameter");

  await sql`
    update public.newsletter_subscribers
       set brevo_synced_at = ${synced ? new Date().toISOString() : null},
           brevo_error = ${synced ? null : detail || `HTTP ${res.status}`},
           updated_at = now()
     where handle = ${handle} and email = ${params.email}
  `.catch(() => undefined);

  if (!synced) {
    console.error("[newsletter] Brevo weigerde de inschrijving", res.status, detail);
    // De lead staat wél in Neon, dus voor de bezoeker is dit geslaagd.
  }
  return { ok: true, message: existed ? "Je stond al ingeschreven." : "Je bent ingeschreven." };
}
