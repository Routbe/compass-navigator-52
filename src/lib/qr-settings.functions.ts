import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";
import { normalizeQrSettings } from "@/lib/qr-settings";

export const getQrSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { sql } = await import("@/lib/neon");
    const rows = await sql`select display_prefs->'qrSettings' as style from public.profiles where id = ${context.userId}`;
    return normalizeQrSettings(rows[0]?.style);
  });

/** Standalone opslag van de profiel-QR-stijl in `profiles.display_prefs->'qrSettings'`. */
export const saveQrSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => {
    const style = normalizeQrSettings(data);
    if (!style) throw new Error("invalid_qr_settings");
    return style;
  })
  .handler(async ({ data, context }) => {
    const { savePublishedProfileQr } = await import("@/lib/profile-drafts.server");
    await savePublishedProfileQr(context.userId, data);
    return { ok: true as const, qrSettings: data };
  });
