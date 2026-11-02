import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware";

/** Admin console: nieuwsbriefleads en hun Brevo-syncstatus. */
export const adminListNewsletterSubscribers = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        search: z.string().max(120).default(""),
        onlyFailed: z.boolean().default(false),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertAdminRole } = await import("./admin.server");
    await assertAdminRole(context.userId);
    const { fetchNewsletterSubscribers } = await import("./admin-newsletter.server");
    return fetchNewsletterSubscribers(data);
  });

/** Admin console: gefaalde Brevo-sync handmatig opnieuw proberen. */
export const adminRetryNewsletterSync = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ id: z.string().uuid().optional(), allFailed: z.boolean().default(false) })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertAdminRole } = await import("./admin.server");
    await assertAdminRole(context.userId);
    const { enforceRateLimit } = await import("./rate-limit.server");
    enforceRateLimit(`admin-newsletter:retry:${context.userId}`, 20, 60_000);
    const { retryNewsletterSync } = await import("./admin-newsletter.server");
    return retryNewsletterSync(data);
  });
