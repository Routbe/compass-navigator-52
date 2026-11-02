/**
 * Sign-up consent (terms + privacy + 16+ or guardian consent, EU digital
 * consent age). No birth date is ever collected: the member confirms with one
 * checkbox and the browser sends this header with the local sign-up request.
 * The auth endpoint refuses a local sign-up without it.
 */
export const SIGNUP_CONSENT_HEADER = "x-rout-consent";
export const SIGNUP_CONSENT_VERSION = "terms-privacy-16plus-v1";
export const DIGITAL_CONSENT_AGE = 16;

/** The local (email + password) account-creation endpoint. */
export const LOCAL_SIGNUP_PATH = "/sign-up/email";

/** The create-account button only becomes active once the box is ticked. */
export function canSubmitSignUp(input: { consented: boolean; busy: boolean; unavailable: boolean; emailError: boolean }): boolean {
  return input.consented && !input.busy && !input.unavailable && !input.emailError;
}

/** True when a request would create a local account without the consent header. */
export function missingSignUpConsent(method: string, relativePath: string, headerValue: string | null): boolean {
  return method.toUpperCase() === "POST" && relativePath === LOCAL_SIGNUP_PATH && headerValue !== SIGNUP_CONSENT_VERSION;
}
