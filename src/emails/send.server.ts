/**
 * Central transactional mailer — Brevo only.
 *
 * Every system e-mail in ROUT (auth links, notifications, alias confirmations,
 * payment follow-ups) goes through this one function. One API key, one
 * dashboard, one set of SPF/DKIM records on our own domain.
 *
 * Delivery cascade (see src/emails/template-ids.ts for the ID scheme):
 *   1. target template   = category base + language offset
 *   2. category fallback = category base + 9   → + admin alert (#11)
 *   3. global fallback   = #21                 → + admin alert (#11)
 *   4. inline HTML/text body rendered by us    → + admin alert (#11)
 *
 * Never throws: a failing mail must not break a webhook or a sign-up. The
 * boolean result plus a logged provider body is the contract.
 */

import { maskEmail } from "@/lib/security/redact";
import {
  adminAlertTemplateId,
  brevoTemplateId,
  globalFallbackTemplateId,
  reserveTemplateId,
  type EmailCategory,
} from "./template-ids";

import { brevoKeyStatus, describeBrevoFailure } from "@/lib/brevo-key";

/** Privacy: ask Brevo not to add open pixels or rewrite links for click tracking. */
export const TRACKING_OFF_HEADERS = {
  "X-Mailin-Track": "0",
  "X-Mailin-Track-Opens": "0",
  "X-Mailin-Track-Clicks": "0",
  // Transactional, never a list/campaign: keeps login mails out of "Promotions".
  "X-Mailin-Tag": "transactional",
} as const;

/** Categories that carry the extra "security" tag. */
const SECURITY_CATEGORIES = new Set([
  "login", "recovery", "email_change", "reauthentication", "confirmation", "security", "merge", "deletion",
]);

/** Every mail is tagged transactional (+ security for auth mails); caller tags are kept. */
export function transactionalTags(category?: string, extra?: string[]): string[] {
  const tags = ["transactional"];
  if (category && SECURITY_CATEGORIES.has(category)) tags.push("security", "auth");
  if (category === "login") tags.push("otp");
  for (const t of extra ?? []) if (t && !tags.includes(t)) tags.push(t);
  return tags;
}

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export interface MailOptions {
  notificationUserId?: string;
  to: string;
  subject?: string;
  html?: string;
  text?: string;
  templateId?: number;
  /** Decimal template hierarchy: category + language decide the Brevo ID. */
  category?: EmailCategory;
  language?: unknown;
  params?: Record<string, unknown>;
  replyTo?: { email: string; name?: string };
  tags?: string[];
  /** Bijlagen (bv. de PDF-factuur), base64-gecodeerd. */
  attachments?: { name: string; contentBase64: string }[];
  /**
   * Email-as-code: send our rendered `html` first and only fall back to the
   * Brevo template cascade when that send is refused.
   */
  htmlFirst?: boolean;
  /** Internal: suppress admin alerts (used by the alert mail itself). */
  skipAdminAlert?: boolean;
  /** Ties every log line of one logical send together; generated when absent. */
  correlationId?: string;
}

export interface AdminAlertParams {
  FAILED_TEMPLATE_ID: number | string;
  USED_FALLBACK_ID: number | string;
  RECIPIENT_EMAIL: string;
  REASON: string;
}

function brevoKey(): string | null {
  return brevoKeyStatus().key;
}

/** Visible sender; must be a domain verified in Brevo. */
function sender(): { name: string; email: string } {
  const from = process.env["EMAIL_FROM"] ?? "";
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return {
    name: process.env["BREVO_SENDER_NAME"] ?? match?.[1] ?? "ROUT",
    email:
      process.env["BREVO_SENDER_EMAIL"] ??
      match?.[2] ??
      (from.includes("@") ? from.trim() : "noreply@send.rout.be"),
  };
}

/** Where customer replies land: the Infomaniak mailbox. */
function defaultReplyTo(): { email: string; name?: string } {
  return {
    email: process.env["BREVO_REPLY_TO_EMAIL"] ?? "hallo@rout.be",
    name: process.env["BREVO_SENDER_NAME"] ?? "ROUT",
  };
}

function adminAddress(): string {
  return process.env["CONTACT_ADMIN_EMAIL"] ?? process.env["ADMIN_EMAIL"] ?? "hallo@rout.be";
}

export function isMailConfigured(): boolean {
  return brevoKey() !== null;
}

/** Correlation id shared by every log line and Brevo attempt of one send. */
export function newCorrelationId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `mail_${Date.now().toString(36)}_${rand}`;
}

/** Rate limits and provider hiccups are worth retrying; a 4xx refusal is not. */
function isTransient(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [400, 1200];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * One Brevo API call with a bounded retry on transient failures (429 / 5xx /
 * network). Returns the provider status + body on definitive failure.
 */
async function postToBrevo(
  key: string,
  body: Record<string, unknown>,
  label: string,
  correlationId = newCorrelationId(),
): Promise<{ sent: boolean; error?: string }> {
  let lastError = "Could not reach the mail provider.";

  for (let try_ = 1; try_ <= MAX_ATTEMPTS; try_++) {
    try {
      const res = await fetch(BREVO_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "api-key": key,
          "x-correlation-id": correlationId,
        },
        body: JSON.stringify(body),
      });

      if (res.status !== 201 && !res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 500);
        lastError = describeBrevoFailure(res.status, detail);
        console.error(`[Brevo API Error] ${label} failed [${res.status}]`, {
          correlationId,
          try: `${try_}/${MAX_ATTEMPTS}`,
          detail,
        });
        if (!isTransient(res.status) || try_ === MAX_ATTEMPTS) {
          return { sent: false, error: lastError };
        }
      } else {
        console.info(`[Mailer] ${label} sent`, {
          correlationId,
          status: res.status,
          try: try_,
        });
        return { sent: true };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Could not reach the mail provider.";
      console.error(`[Mailer] ${label} threw`, {
        correlationId,
        try: `${try_}/${MAX_ATTEMPTS}`,
        error: lastError,
      });
      if (try_ === MAX_ATTEMPTS) return { sent: false, error: lastError };
    }

    await wait(BACKOFF_MS[try_ - 1] ?? 1200);
    console.warn(`[Mailer] retrying ${label}`, { correlationId, nextTry: try_ + 1 });
  }

  return { sent: false, error: lastError };
}

function textFromHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Log-safe view of the template params: only the keys and value lengths are
 * logged, so a broken template variable stays visible while names, e-mail
 * addresses, message text, links and codes never reach a log.
 */
export function summariseParams(params?: Record<string, unknown>): Record<string, string> {
  if (!params) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") {
      out[key] = "(empty)";
      continue;
    }
    const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
    out[key] = SAFE_PARAM_KEYS.has(key.toUpperCase()) && /^[a-z-]{2,10}$/i.test(text)
      ? text
      : `<${text.length} chars>`;
  }
  return out;
}

/** Only these short, non-personal settings are logged verbatim. */
const SAFE_PARAM_KEYS = new Set(["LANG", "LANGUAGE", "LOCALE"]);

/**
 * Fire-and-forget admin alert (Template #11) telling the team exactly which
 * template failed and which fallback carried the message instead.
 */
export function notifyAdminOfFallback(params: AdminAlertParams): void {
  const key = brevoKey();
  const templateId = adminAlertTemplateId();
  if (!key) {
    console.error("[Mailer Alert] Cannot send admin alert — BREVO_API_KEY is missing", params);
    return;
  }
  const body: Record<string, unknown> = {
    sender: sender(),
    to: [{ email: adminAddress() }],
    templateId,
    params,
    replyTo: defaultReplyTo(),
    headers: TRACKING_OFF_HEADERS,
    tags: transactionalTags("system", ["mailer-fallback-alert"]),
  };
  void postToBrevo(key, body, `admin alert template #${templateId}`).then((res) => {
    if (!res.sent) {
      // Last resort: an inline alert so the failure is never invisible.
      void postToBrevo(
        key,
        {
          sender: sender(),
          to: [{ email: adminAddress() }],
          subject: `[ROUT] Mail fallback: template ${params.FAILED_TEMPLATE_ID} failed`,
          htmlContent:
            `<p>Template <strong>${params.FAILED_TEMPLATE_ID}</strong> failed.</p>` +
            `<p>Used fallback: <strong>${params.USED_FALLBACK_ID}</strong></p>` +
            `<p>Recipient: ${params.RECIPIENT_EMAIL}</p>` +
            `<p>Reason: ${params.REASON}</p>`,
          headers: TRACKING_OFF_HEADERS,
    tags: transactionalTags("system", ["mailer-fallback-alert"]),
        },
        "admin alert inline fallback",
      );
    }
  });
}

interface Attempt {
  label: string;
  id: number | "inline";
  body: Record<string, unknown>;
}

/**
 * Sends one transactional mail through the four-step cascade described above.
 * Every failing step logs the exact Brevo status/body and alerts the admin.
 */
export async function sendMail(opts: MailOptions): Promise<{ sent: boolean; error?: string }> {
  let listHeaders: Record<string, string> = {};
  if (opts.notificationUserId) {
    try {
      const { notificationMailPolicy } = await import("@/lib/email/unsubscribe.server");
      const policy = await notificationMailPolicy(opts.notificationUserId, opts.category, opts.tags);
      if (!policy.allowed) return { sent: false, error: "Notification email disabled by recipient." };
      listHeaders = policy.headers;
    } catch {
      return { sent: false, error: "Notification preference check unavailable." };
    }
  }
  const { key, error: keyError } = brevoKeyStatus();
  const correlationId = opts.correlationId ?? newCorrelationId();
  if (!key) {
    console.error(`[Mailer] ${keyError}`, {
      correlationId,
      subject: opts.subject,
      to: maskEmail(opts.to),
    });
    return { sent: false, error: keyError ?? "E-mailverzending is niet geconfigureerd." };
  }

  const base: Record<string, unknown> = {
    sender: sender(),
    to: [{ email: opts.to }],
    ...(opts.subject ? { subject: opts.subject } : {}),
    ...(opts.params ? { params: opts.params } : {}),
    replyTo: opts.replyTo ?? defaultReplyTo(),
    headers: { ...TRACKING_OFF_HEADERS, ...listHeaders },
    tags: transactionalTags(opts.category, opts.tags),
    ...(opts.attachments?.length
      ? {
          attachment: opts.attachments.map((file) => ({
            name: file.name,
            content: file.contentBase64,
          })),
        }
      : {}),
  };

  const attempts: Attempt[] = [];

  // 1 — target template (base + language offset), or an explicit override.
  const targetTemplateId =
    opts.templateId ?? (opts.category ? brevoTemplateId(opts.category, opts.language) : null);
  if (targetTemplateId) {
    attempts.push({
      label: `template #${targetTemplateId}`,
      id: targetTemplateId,
      body: { ...base, templateId: targetTemplateId },
    });
  }

  // 2 — category fallback (0 = the category has no template in Brevo).
  if (opts.category) {
    const reserve = reserveTemplateId(opts.category);
    if (reserve && reserve !== targetTemplateId) {
      attempts.push({
        label: `category fallback template #${reserve}`,
        id: reserve,
        body: { ...base, templateId: reserve },
      });
    }
  }

  // 3 — global customer fallback (#21).
  const globalId = globalFallbackTemplateId();
  if (!attempts.some((a) => a.id === globalId)) {
    attempts.push({
      label: `global fallback template #${globalId}`,
      id: globalId,
      body: { ...base, templateId: globalId },
    });
  }

  // 4 — our own rendered body. Fragments get the ROUT frame and go first
  // (email as code); Brevo templates stay as the safety net.
  if (opts.html || opts.text) {
    let html = opts.html ?? `<pre>${opts.text}</pre>`;
    const text = opts.text ?? textFromHtml(html);
    let first = Boolean(opts.htmlFirst && opts.html);
    if (opts.html && !/<html[\s>]/i.test(opts.html)) {
      const { brandHtml } = await import("./react/branded.server");
      const branded = await brandHtml(opts.html, {
        language: opts.language,
        preview: opts.subject,
        ...(opts.category ? { category: opts.category } : {}),
      });
      if (branded) {
        html = branded;
        first = true;
      }
    }
    attempts[first ? "unshift" : "push"]({
      label: "inline HTML body",
      id: "inline",
      body: {
        ...base,
        subject: opts.subject ?? "ROUT",
        htmlContent: html,
        textContent: text,
      },
    });
  }

  if (attempts.length === 0) {
    console.error("[Mailer] nothing to send: no templateId, category or body supplied", {
      correlationId,
    });
    return { sent: false, error: "No template or body was provided for this e-mail." };
  }

  const cascade = attempts.map((a) => a.id);
  const paramSummary = summariseParams(opts.params);
  console.info("[Mailer] delivery plan", {
    correlationId,
    to: maskEmail(opts.to),
    category: opts.category ?? "(none)",
    language: opts.language ?? "(default)",
    cascade,
    params: paramSummary,
  });

  let lastError = "Brevo did not accept this message.";
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i]!;
    console.info(
      `[Mailer] attempt ${i + 1}/${attempts.length} — template ${attempt.id} → ${maskEmail(opts.to)}`,
      { correlationId },
    );
    const result = await postToBrevo(key, attempt.body, attempt.label, correlationId);
    // The admin alert for a fallback is emitted at the moment the previous
    // template failed, so a successful attempt needs no extra notification.
    if (result.sent) {
      if (i > 0) {
        console.warn("[Mailer Fallback] delivered via fallback", {
          correlationId,
          category: opts.category ?? "(none)",
          language: opts.language ?? "(default)",
          failedTemplateIds: cascade.slice(0, i),
          deliveredWithTemplateId: attempt.id,
          attempt: `${i + 1}/${attempts.length}`,
          recipient: maskEmail(opts.to),
          params: paramSummary,
        });
      }
      return { sent: true };
    }
    lastError = result.error ?? lastError;
    const next = attempts[i + 1];
    if (next) {
      console.warn("[Mailer Fallback] template failed — falling back", {
        correlationId,
        category: opts.category ?? "(none)",
        language: opts.language ?? "(default)",
        failedTemplateId: attempt.id,
        failedTemplateLabel: attempt.label,
        fallbackTemplateId: next.id,
        fallbackLabel: next.label,
        remainingCascade: cascade.slice(i + 1),
        adminAlertTemplateId: adminAlertTemplateId(),
        recipient: maskEmail(opts.to),
        reason: lastError,
        params: paramSummary,
      });
      if (!opts.skipAdminAlert) {
        notifyAdminOfFallback({
          FAILED_TEMPLATE_ID: attempt.id,
          USED_FALLBACK_ID: next.id,
          RECIPIENT_EMAIL: opts.to,
          REASON: `${lastError} [${correlationId}]`,
        });
      }
    }
  }

  console.error("[Mailer] all delivery attempts failed", {
    correlationId,
    category: opts.category ?? "(none)",
    language: opts.language ?? "(default)",
    triedTemplateIds: cascade,
    recipient: maskEmail(opts.to),
    reason: lastError,
    params: paramSummary,
  });
  if (!opts.skipAdminAlert) {
    notifyAdminOfFallback({
      FAILED_TEMPLATE_ID: attempts[attempts.length - 1]!.id,
      USED_FALLBACK_ID: "none",
      RECIPIENT_EMAIL: opts.to,
      REASON: lastError,
    });
  }
  return { sent: false, error: lastError };
}
