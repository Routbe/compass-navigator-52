import { BRAND, LOGO_INNER, LOGO_VIEWBOX } from "@/lib/brand/logo";

export const ROUT_BUTTON_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}" width="20" height="25" fill="currentColor" aria-hidden="true"><g>${LOGO_INNER}</g></svg>`;

/** These are routes the integrator implements, never ROUT authorization URLs. */
export function routButtonSnippet(mode: "login" | "connect") {
  const label = mode === "login" ? "Doorgaan met ROUT" : "Connect ROUT";
  return `<!-- Implement this POST handler in YOUR app before enabling this button.
It creates state, nonce and PKCE, then redirects using OIDC discovery.
Connect requires an existing local session and never replaces that session.
Include your framework's CSRF field/protection in this form. -->
<form method="post" action="/auth/rout/${mode}">
  <button class="rout-button" type="submit">
    ${ROUT_BUTTON_LOGO}
    <span>${label}</span>
  </button>
</form>
<style>
  :root { --rout-button-bg: ${BRAND.paper}; --rout-button-ink: ${BRAND.ink}; }
  .rout-button { display: inline-flex; align-items: center; justify-content: center;
    gap: 10px; min-height: 44px; padding: 10px 18px; border-radius: 8px;
    background: var(--rout-button-bg); color: var(--rout-button-ink);
    border: 1px solid currentColor; font: inherit; cursor: pointer; }
  .rout-button svg { width: 20px; height: 25px; flex-shrink: 0; }
  .rout-button:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
  .rout-button:disabled { opacity: .5; cursor: not-allowed; }
</style>`;
}