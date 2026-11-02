/**
 * Wallet pass content for profiles and events (pure, browser-safe).
 * Apple (.pkpass pass.json) and Google (Generic pass object) are built from the
 * same subject so both wallets always show the same card.
 */

export type WalletKind = "profile" | "event";
export type WalletSubject = {
  kind: WalletKind;
  /** Stable id: profile handle or event slug. */
  id: string;
  title: string;
  subtitle: string;
  url: string;
  /** ISO start time (events only). */
  startsAt?: string | null;
  venue?: string | null;
  /**
   * Events only: true when a paid or verified booking proves access. Without
   * it the pass is informational and carries no barcode or access claim.
   */
  accessClaim?: boolean;
};

export type WalletStatus = { apple: boolean; google: boolean };

type Env = Record<string, string | undefined>;
const pick = (env: Env, ...keys: string[]) => keys.map((k) => env[k]?.trim()).find((v) => !!v) ?? "";

export type AppleWalletConfig = { passTypeId: string; teamId: string; certPem: string; keyPem: string; passphrase: string; wwdrPem: string };
export type GoogleWalletConfig = { issuerId: string; serviceAccountEmail: string; privateKey: string };

/** Resolves Apple config; accepts both APPLE_WALLET_* and APPLE_PASS_* names. Null = not (fully) configured. */
export function appleWalletConfig(env: Env): AppleWalletConfig | null {
  const c = {
    passTypeId: pick(env, "APPLE_WALLET_PASS_TYPE_ID", "APPLE_PASS_TYPE_ID"),
    teamId: pick(env, "APPLE_WALLET_TEAM_ID", "APPLE_TEAM_ID"),
    certPem: pick(env, "APPLE_WALLET_CERT_PEM", "APPLE_PASS_CERTIFICATE"),
    keyPem: pick(env, "APPLE_WALLET_KEY_PEM", "APPLE_PASS_KEY"),
    passphrase: pick(env, "APPLE_WALLET_KEY_PASSPHRASE", "APPLE_PASS_KEY_PASSPHRASE"),
    wwdrPem: pick(env, "APPLE_WALLET_WWDR_PEM", "APPLE_WWDR_CERTIFICATE"),
  };
  return c.passTypeId && c.teamId && c.certPem && c.keyPem && c.wwdrPem ? c : null;
}

/** Resolves Google config from separate vars or the service-account JSON (GOOGLE_WALLET_SERVICE_ACCOUNT). */
export function googleWalletConfig(env: Env): GoogleWalletConfig | null {
  let email = pick(env, "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL");
  let key = pick(env, "GOOGLE_WALLET_PRIVATE_KEY");
  const json = pick(env, "GOOGLE_WALLET_SERVICE_ACCOUNT");
  if (json && (!email || !key)) {
    try {
      const sa = JSON.parse(json) as { client_email?: unknown; private_key?: unknown };
      if (!email && typeof sa.client_email === "string") email = sa.client_email;
      if (!key && typeof sa.private_key === "string") key = sa.private_key;
    } catch {
      /* malformed JSON = not configured */
    }
  }
  const issuerId = pick(env, "GOOGLE_WALLET_ISSUER_ID");
  return issuerId && email && key ? { issuerId, serviceAccountEmail: email, privateKey: key } : null;
}

/** Which wallets can issue passes; partial configuration counts as off. */
export function walletStatus(env: Env): WalletStatus {
  return { apple: !!appleWalletConfig(env), google: !!googleWalletConfig(env) };
}

export function isWalletKind(v: unknown): v is WalletKind {
  return v === "profile" || v === "event";
}

/** Serial/object suffix: only [a-z0-9._-], max 64 chars, kind-prefixed so ids never collide. */
export function walletSerial(s: Pick<WalletSubject, "kind" | "id">): string {
  return `${s.kind}-${s.id.toLowerCase().replace(/[^a-z0-9._-]/g, "-")}`.slice(0, 64);
}

const clip = (v: string | null | undefined, n: number) => (v ?? "").slice(0, n);

/** Apple pass.json (generic style). */
export function applePassJson(s: WalletSubject, cfg: { passTypeId: string; teamId: string }) {
  const isEvent = s.kind === "event";
  return {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeId,
    teamIdentifier: cfg.teamId,
    serialNumber: walletSerial(s),
    organizationName: "ROUT",
    description: isEvent ? `Evenement: ${clip(s.title, 60)}` : `ROUT-visitekaartje van ${clip(s.title, 60)}`,
    logoText: "ROUT",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(17, 17, 17)",
    labelColor: "rgb(180, 180, 180)",
    ...(isEvent && s.startsAt ? { relevantDate: s.startsAt } : {}),
    // Barcode = toegangsclaim: bij events alleen met een bewezen betaalde of
    // geverifieerde boeking. Informatieve passes krijgen geen barcode.
    ...(!isEvent || s.accessClaim === true
      ? { barcodes: [{ format: "PKBarcodeFormatQR", message: s.url, messageEncoding: "iso-8859-1", altText: clip(s.url.replace(/^https?:\/\//, ""), 60) }] }
      : {}),
    generic: {
      primaryFields: [{ key: "title", label: isEvent ? (s.accessClaim === true ? "EVENEMENT" : "INFORMATIEF") : "PROFIEL", value: clip(s.title, 60) }],
      secondaryFields: [{ key: "subtitle", label: isEvent ? "WANNEER" : "HANDLE", value: clip(s.subtitle, 60) }],
      ...(isEvent && s.venue ? { auxiliaryFields: [{ key: "venue", label: "LOCATIE", value: clip(s.venue, 60) }] } : {}),
      backFields: [{ key: "link", label: "Link", value: s.url }],
    },
  };
}

/** Google Wallet "Save to Google Wallet" JWT claims (class + object inline). */
export function googleSaveClaims(s: WalletSubject, cfg: { issuerId: string; serviceAccountEmail: string; origins: string[] }) {
  const classId = `${cfg.issuerId}.rout_${s.kind}`;
  const object = {
    id: `${cfg.issuerId}.${walletSerial(s).replace(/[^a-zA-Z0-9._-]/g, "_")}`,
    classId,
    state: "ACTIVE",
    hexBackgroundColor: "#111111",
    cardTitle: { defaultValue: { language: "nl", value: "ROUT" } },
    header: { defaultValue: { language: "nl", value: clip(s.title, 60) } },
    subheader: { defaultValue: { language: "nl", value: s.kind === "event" ? (s.accessClaim === true ? "Evenement" : "Informatief") : "Profiel" } },
    textModulesData: [
      { id: "subtitle", header: s.kind === "event" ? "Wanneer" : "Handle", body: clip(s.subtitle, 120) },
      ...(s.venue ? [{ id: "venue", header: "Locatie", body: clip(s.venue, 120) }] : []),
    ],
    // Zie applePassJson: een barcode is een toegangsclaim en vereist bewijs.
    ...(s.kind !== "event" || s.accessClaim === true
      ? { barcode: { type: "QR_CODE", value: s.url, alternateText: clip(s.url.replace(/^https?:\/\//, ""), 60) } }
      : {}),
    linksModuleData: { uris: [{ uri: s.url, description: "Open in ROUT", id: "open" }] },
  };
  return {
    iss: cfg.serviceAccountEmail,
    aud: "google",
    typ: "savetowallet",
    origins: cfg.origins,
    payload: { genericClasses: [{ id: classId }], genericObjects: [object] },
  };
}
