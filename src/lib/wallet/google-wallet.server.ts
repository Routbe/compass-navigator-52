/** Google Wallet "Save" link: RS256 JWT signed with the service account key. */
import { googleSaveClaims, type GoogleWalletConfig, type WalletSubject } from "./wallet-pass";

export async function googleSaveUrl(subject: WalletSubject, origin: string, cfg: GoogleWalletConfig): Promise<string> {
  const { SignJWT, importPKCS8 } = await import("jose");
  const claims = googleSaveClaims(subject, { issuerId: cfg.issuerId, serviceAccountEmail: cfg.serviceAccountEmail, origins: [origin] });
  const key = await importPKCS8(cfg.privateKey.replace(/\\n/g, "\n").trim(), "RS256");
  const { iss, aud, ...rest } = claims;
  const jwt = await new SignJWT(rest as Record<string, unknown>)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt()
    .sign(key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
