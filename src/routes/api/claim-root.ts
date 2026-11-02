import { createFileRoute } from "@tanstack/react-router";
import { hasDatabase, sql } from "@/lib/neon";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session.server";
import { clientIp } from "@/lib/api-guard.server";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit.server";

const claimSchema = z.object({
  userId: z.string().uuid(),
  handle: z.string().min(1).max(64),
  email: z.string().email(),
  userName: z.string().min(1).max(120),
});

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
/** Max 3 pogingen per gebruiker/IP per 10 minuten. */
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

type MailStatus = "sent" | "failed" | "failed_brevo_key" | "failed_network";

/** Stuurt één Brevo-template en rapporteert de exacte foutoorzaak terug. */
async function sendBrevo(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<{ status: MailStatus; error: string | null }> {
  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { status: "sent", error: null };
    const body = await res.text().catch(() => "");
    const status: MailStatus =
      res.status === 401 || res.status === 403 ? "failed_brevo_key" : "failed";
    return { status, error: `HTTP ${res.status}: ${body.slice(0, 500)}` };
  } catch (error) {
    return {
      status: "failed_network",
      error: error instanceof Error ? error.message : "network error",
    };
  }
}

export const Route = createFileRoute("/api/claim-root")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Authenticatie — Neon Auth sessie.
        const session = await currentUser();
        if (!session) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Ongeldige JSON-body" }, { status: 400 });
        }

        const parsed = claimSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Ongeldige invoer" }, { status: 400 });
        }
        const { userId, handle, userName } = parsed.data;
        // Always mail the signed-in account's own address, never a typed one.
        const email = (session as { email?: string | null }).email ?? "";
        if (!email) return Response.json({ error: "Geen e-mailadres op dit account" }, { status: 400 });

        // Geen impersonatie: het sessie-ID moet exact matchen.
        if (session.id !== userId) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        // 2. Rate limiting per gebruiker én per IP.
        try {
          enforceRateLimit(`claim-root:user:${userId}`, RATE_LIMIT, RATE_WINDOW_MS);
          enforceRateLimit(`claim-root:ip:${clientIp(request)}`, RATE_LIMIT, RATE_WINDOW_MS);
        } catch (error) {
          const retryAfter = error instanceof RateLimitError ? error.retryAfterSeconds : 600;
          return Response.json(
            { error: "Te veel aanvragen. Probeer het later opnieuw." },
            { status: 429, headers: { "retry-after": String(retryAfter) } },
          );
        }

        const cleanHandle = handle.replace(/^@/, "").toLowerCase();
        const requestedSubdomain = `${cleanHandle}.rout.be`;

        const brevoApiKey = process.env["BREVO_API_KEY"];
        if (!hasDatabase()) {
          console.error("[claim-root] no database configured (DATABASE_URL or Neon connector)");
          return Response.json({ error: "Serverconfiguratie ontbreekt" }, { status: 500 });
        }

        // 3. Dubbele claim afvangen.
        const existing = (await sql`
          select username, subdomain_tier, root_subdomain_status
            from public.profiles
           where id = ${userId}
           limit 1
        `) as Array<Record<string, unknown>>;
        const current = existing[0];
        if (!current) {
          return Response.json({ error: "Profiel niet gevonden" }, { status: 404 });
        }
        const currentStatus = (current["root_subdomain_status"] as string | null) ?? "none";
        const currentTier = (current["subdomain_tier"] as string | null) ?? "free";
        const currentUsername = ((current["username"] as string | null) ?? "").toLowerCase();
        if (currentTier !== "root_lifetime") {
          return Response.json(
            { error: "payment_required", message: "Rond eerst de betaling voor het root-subdomein af." },
            { status: 402 },
          );
        }
        if (currentStatus === "pending_dns" || currentStatus === "active") {
          return Response.json(
            {
              error: "Er loopt al een aanvraag voor dit account.",
              subdomain: requestedSubdomain,
              status: currentStatus,
              tier: currentTier,
            },
            { status: 409 },
          );
        }

        // 4. Naamruimte bewaken via de gedeelde controle: username,
        // subdomain_alias en alias_profiles.handle delen één naamruimte.
        const { isHandleAvailableFor } = await import("@/lib/handle-namespace.server");
        const free = await isHandleAvailableFor(cleanHandle, userId);
        if (!free) {
          return Response.json(
            { error: "Deze naam is al in gebruik door een ander account." },
            { status: 409 },
          );
        }

        // 5. Handle én status in één transactie persisteren. Bij een
        // naamwijziging schuift `username` mee, zodat rout.be/<naam> en de
        // root-URL altijd naar dezelfde handle wijzen.
        const renaming = cleanHandle !== currentUsername;
        // De gratis handle mag nooit verdwijnen: voordat `username` naar de
        // geverifieerde naam schuift, verhuist de oude naam naar het gratis
        // aliasprofiel (rout.be/u/<oude naam>).
        if (renaming && currentUsername) {
          const { preserveFreeAliasHandle } = await import("@/lib/alias-profile.server");
          await preserveFreeAliasHandle(userId, currentUsername);
        }
        try {
          await sql.transaction([
            sql`
              update public.profiles
                 set subdomain_tier = 'root_lifetime',
                     root_subdomain_status = 'pending_dns',
                     subdomain_alias = ${cleanHandle},
                     username = case when ${renaming} then ${cleanHandle} else username end
               where id = ${userId}
                 -- Race-bescherming: alleen wanneer er nog geen claim liep.
                 and coalesce(root_subdomain_status, 'none') = 'none'
            `,
            sql`
              insert into public.subdomain_root_claims
                (user_id, requested_subdomain, admin_mail_status, user_mail_status)
              values (${userId}, ${requestedSubdomain}, 'pending', 'pending')
            `,
          ]);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const taken = /duplicate|unique|handle_taken/i.test(message);
          console.error("[claim-root] persist failed:", message);
          return Response.json(
            {
              error: taken
                ? "Deze naam is al in gebruik door een ander account."
                : "Aanvraag kon niet opgeslagen worden.",
            },
            { status: taken ? 409 : 500 },
          );
        }


        // 6. Brevo-verzending met gedetailleerde foutrapportage.
        let adminMail: { status: MailStatus; error: string | null } = {
          status: "failed_brevo_key",
          error: "BREVO_API_KEY ontbreekt",
        };
        let userMail = adminMail;

        if (brevoApiKey) {
          const adminEmail = process.env["ADMIN_EMAIL"] ?? "admin@rout.be";
          [adminMail, userMail] = await Promise.all([
            sendBrevo(brevoApiKey, {
              templateId: 2,
              to: [{ email: adminEmail }],
              params: {
                requested_subdomain: requestedSubdomain,
                cname_source: cleanHandle,
                user_name: userName,
                user_email: email,
              },
            }),
            sendBrevo(brevoApiKey, {
              templateId: 3,
              to: [{ email }],
              params: {
                user_name: userName,
                requested_subdomain: requestedSubdomain,
                active_subdomain: requestedSubdomain,
              },
            }),
          ]);
        }

        // 7. Audit log bijwerken (de rij is in stap 5 mee aangemaakt).
        const errorPayload =
          adminMail.error || userMail.error
            ? JSON.stringify({ admin: adminMail.error, user: userMail.error })
            : null;
        try {
          await sql`
            update public.subdomain_root_claims
               set admin_mail_status = ${adminMail.status},
                   user_mail_status = ${userMail.status},
                   error_payload = ${errorPayload}
             where user_id = ${userId}
               and requested_subdomain = ${requestedSubdomain}
               and admin_mail_status = 'pending'
          `;
        } catch (error) {
          console.error("[claim-root] audit log update failed:", error);
        }


        return Response.json({
          success: true,
          admin_email: adminMail.status,
          user_email: userMail.status,
          admin_mail_error: adminMail.error,
          user_mail_error: userMail.error,
          subdomain: requestedSubdomain,
          status: "pending_dns",
        });
      },
    },
  },
});
