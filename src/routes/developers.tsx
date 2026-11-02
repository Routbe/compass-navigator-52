import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { CodeBlock } from "@/components/CodeBlock";
import { RoutButtonKit } from "@/components/dev/RoutButtonKit";
import { DISCOVERY_URL, handleUpdatedSample, WEBHOOK_VERIFY_SNIPPET } from "@/lib/oauth/integration-templates";

const HANDLE_SAMPLE = handleUpdatedSample("rout_your_client_id");
import { RATE_RULES } from "@/lib/rate-limit-rules";

const TITLE = "Developers — Login met ROUT, verificaties en API";
const DESC = "Integreer Login met ROUT (OIDC + PKCE), begrijp hoe verificaties werken en bekijk alle endpoints, foutcodes en limieten.";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DevelopersPage,
});

const NAV = [
  { id: "start", label: "Snel starten" },
  { id: "pkce", label: "Code-flow met PKCE" },
  { id: "claims", label: "Scopes en claims" },
  { id: "client", label: "Je eigen app bouwen" },
  { id: "handle-sync", label: "Universal Handle Sync" },
  { id: "verifications", label: "Hoe verificaties werken" },
  { id: "api", label: "API-overzicht" },
  { id: "errors", label: "Foutcodes en limieten" },
];

const PKCE_JS = `// Server-side start handler: only run after the form's explicit POST.
// Pseudocode: use your OIDC library + framework cookie/CSRF helpers.
const clientId = process.env.ROUT_CLIENT_ID;
const redirectUri = process.env.ROUT_REDIRECT_URI; // exact registered URL in YOUR app
if (!clientId || !redirectUri) throw new Error("ROUT is not configured");
// 1. Discovery ophalen (nooit endpoints hardcoden)
const oidc = await fetch("${DISCOVERY_URL}").then((r) => r.json());

// 2. Per poging: verifier, state en nonce — bewaar ze in een HttpOnly-cookie
const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)))
  .replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
const verifier = b64(crypto.getRandomValues(new Uint8Array(32)));
const challenge = b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
const state = crypto.randomUUID();
const nonce = crypto.randomUUID();

// 3. Doorsturen
const url = new URL(oidc.authorization_endpoint);
url.search = new URLSearchParams({
  response_type: "code",
  client_id: clientId,
  redirect_uri: redirectUri,
  scope: "openid profile email",
  code_challenge: challenge,
  code_challenge_method: "S256",
  state, nonce,
}).toString();
// Persist verifier/state/nonce in a short-lived HttpOnly Secure SameSite=Lax cookie,
// then return a redirect to url. Never run this when the page merely loads.`;

const TOKEN_JS = `// Op je server, in /auth/callback/rout — na controle van state
const res = await fetch(oidc.token_endpoint, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code, redirect_uri, code_verifier: verifier,
    client_id: process.env.ROUT_CLIENT_ID,
    client_secret: process.env.ROUT_CLIENT_SECRET, // nooit in de browser
  }),
});
const { id_token, access_token } = await res.json();
// Controleer id_token via jwks_uri (ES256): iss, aud === client_id, exp en nonce.`;

const SCHEMA_SQL = `alter table users add column if not exists rout_id text unique;
alter table users add column if not exists email_verified boolean not null default false;
alter table users add column if not exists is_verified_person boolean not null default false;
alter table users add column if not exists is_verified_business boolean not null default false;
alter table users add column if not exists is_influencer boolean not null default false;

create table if not exists user_identities (
  user_id uuid not null references users(id) on delete cascade,
  provider text not null,          -- 'rout'
  subject text not null,           -- sub-claim
  primary key (provider, subject)
);`;

const ENDPOINTS = [
  ["GET", "/.well-known/openid-configuration", "Discovery-document (CORS open)"],
  ["GET", "/.well-known/jwks.json", "Publieke ES256-sleutels voor id_token (CORS open)"],
  ["GET", "/oauth/authorize", "Toestemmingsscherm; start de code-flow"],
  ["POST", "/api/public/oauth/token", "Code inwisselen (PKCE S256 verplicht)"],
  ["GET", "/api/public/oauth/userinfo", "Claims met Bearer access_token"],
];

const ERRORS = [
  ["invalid_request", "400", "Verplichte velden ontbreken of zijn ongeldig."],
  ["invalid_client", "401", "Onbekende app, fout geheim of IP niet toegelaten."],
  ["invalid_grant", "400", "Code verlopen, al gebruikt, fout redirect_uri of PKCE klopt niet."],
  ["unsupported_grant_type", "400", "Alleen authorization_code wordt ondersteund."],
  ["access_denied", "—", "De gebruiker weigerde toestemming (komt terug als ?error=)."],
  ["rate_limited", "429", "Te veel pogingen. Wacht het aantal seconden uit Retry-After."],
];

function DevelopersPage() {
  return (
    <AppLayout crumbs={[{ label: "Developers" }]}>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Inhoud" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1 text-sm">
            {NAV.map((n) => (
              <li key={n.id}><a href={`#${n.id}`} className="block rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">{n.label}</a></li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 space-y-14 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:font-medium [&_p]:leading-relaxed [&_p]:text-muted-foreground">
          <header className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">ROUT Developers</p>
            <h1 className="text-4xl font-semibold tracking-tight">Login met ROUT</h1>
            <p className="max-w-2xl text-muted-foreground">Een standaard OpenID Connect-provider met PKCE, geverifieerde e-mail en optionele badges. Geen SDK nodig: elke OIDC-bibliotheek werkt.</p>
          </header>

          <section id="start" className="scroll-mt-24 space-y-4">
            <h2>Snel starten</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Maak een app in de <Link to="/console/apps/new" className="text-foreground underline">Developer Console</Link>: naam, website en terug-adressen.</li>
              <li>Bewaar de <code>client_id</code> en het eenmalig getoonde <code>client_secret</code> op je server.</li>
              <li>Wijs je OIDC-bibliotheek naar het discovery-adres hieronder.</li>
            </ol>
            <CodeBlock code={DISCOVERY_URL} language="text" />
            <p>Maak eerst de starthandler en callback in jouw eigen app en test de terugkeer. Activeer pas daarna de knop. Een ROUT-app aanmaken activeert geen login in jouw website en voegt geen Google-login toe. De voorbeelden hieronder zijn server-pseudocode; gebruik een OIDC-bibliotheek voor de volledige flow.</p>
          </section>

          <RoutButtonKit />

          <section id="pkce" className="scroll-mt-24 space-y-4">
            <h2>Code-flow met PKCE (S256)</h2>
            <p>PKCE is altijd verplicht, ook voor apps met een geheim. Terug-adressen moeten letterlijk overeenkomen met wat je registreerde (https, http enkel voor localhost, geen * en geen #).</p>
            <CodeBlock code={PKCE_JS} language="javascript" />
            <CodeBlock code={TOKEN_JS} language="javascript" />
            <p>Codes zijn eenmalig en kortlevend. Het geheim stuur je mee als <code>client_secret_post</code> of via HTTP Basic; single-page en mobiele apps gebruiken geen geheim.</p>
          </section>

          <section id="claims" className="scroll-mt-24 space-y-4">
            <h2>Scopes en claims</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left"><tr><th className="p-3">Scope</th><th className="p-3">Claims</th></tr></thead>
                <tbody className="divide-y divide-border">
                  <tr><td className="p-3 font-mono">openid</td><td className="p-3 text-muted-foreground"><code>sub</code> — vaste, unieke ROUT-ID</td></tr>
                  <tr><td className="p-3 font-mono">profile</td><td className="p-3 text-muted-foreground"><code>name</code>, <code>preferred_username</code>, <code>picture</code>; plus <code>rout_handle</code> als de app Universal Handle Sync aanzet</td></tr>
                  <tr><td className="p-3 font-mono">email</td><td className="p-3 text-muted-foreground"><code>email</code>, <code>email_verified</code></td></tr>
                  <tr><td className="p-3 font-mono">linked_accounts</td><td className="p-3 text-muted-foreground">Gekoppelde sociale accounts die de gebruiker deelt</td></tr>
                  <tr><td className="p-3 font-mono">Rich Identity</td><td className="p-3 text-muted-foreground"><code>rout_public_activity</code> (lijst van <code>kind</code>, <code>title</code>, <code>occurred_at</code>) in het id_token — alleen als de app dit aanzet én de gebruiker het vakje aanvinkt</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="client" className="scroll-mt-24 space-y-4">
            <h2>Je eigen app bouwen</h2>
            <p>Aanbevolen opbouw voor een app die "Login met ROUT" gebruikt:</p>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li><b className="text-foreground">Knop:</b> het officiële ROUT-logo met lokale tekst ("Login met ROUT", "Se connecter avec ROUT", "Mit ROUT anmelden").</li>
              <li><b className="text-foreground">Popup of doorsturen:</b> open een gecentreerde popup (500 × 650). Geblokkeerd? Stuur dan gewoon door; verifier, state en nonce blijven in een HttpOnly-, Secure-, SameSite=Lax-cookie.</li>
              <li><b className="text-foreground">Callback</b> op het geregistreerde adres in jouw eigen app (bijvoorbeeld <code>/auth/callback/rout</code>, geen ROUT-endpoint): controleer state, wissel de code in op de server, controleer het id_token (ES256 via JWKS; iss, aud, exp, nonce).</li>
              <li><b className="text-foreground">Sessie:</b> maak je eigen sessiecookie. Tokens komen nooit in browser-JavaScript.</li>
              <li><b className="text-foreground">Koppelen:</b> bestaat er al een gebruiker met hetzelfde <i>geverifieerde</i> e-mailadres, koppel ROUT dan aan dat account (in <code>user_identities</code>) in plaats van een dubbel account te maken. Anders: nieuw account met <code>rout_id = sub</code>.</li>
              <li><b className="text-foreground">Rich Identity:</b> overschrijf <code>rout_public_activity</code> bij elke login vanuit het id_token en wis het als de claim ontbreekt. Vertrouw nooit invoer uit de browser.</li>
              <li><b className="text-foreground">Fouten:</b> vertaal <code>?error=</code> naar een vriendelijke melding (zie <a href="#errors" className="underline">foutcodes</a>).</li>
            </ul>
            <CodeBlock code={SCHEMA_SQL} language="sql" />
          </section>

          <section id="handle-sync" className="scroll-mt-24 space-y-4">
            <h2>Universal Handle Sync en webhooks</h2>
            <p>Zet Universal Handle Sync aan in de console om ROUT de bron van gebruikersnamen te maken. Met de scope <code>profile</code> krijg je dan de claim <code>rout_handle</code> (in het id_token en via userinfo). Gebruik die als unieke <code>username</code>, maar koppel gebruikers altijd op <code>sub</code>: een handle kan veranderen.</p>
            <p>Handlewijzigingen gebruiken een ondertekende POST <code>user.handle.updated</code> naar je webhook. Controleer de header <code>x-rout-signature: t=…,v1=…</code> (HMAC-SHA256 over <code>t.body</code>, maximaal 5 minuten oud) en sla verwerkte event-id's op. Test levering voor jouw app voordat je synchronisatie als actief toont.</p>
            <CodeBlock code={HANDLE_SAMPLE} language="json" />
            <CodeBlock code={WEBHOOK_VERIFY_SNIPPET} language="javascript" />
          </section>

          <section id="verifications" className="scroll-mt-24 space-y-4">
            <h2>Hoe verificaties werken</h2>
            <p>Een badge betekent dat ROUT zelf iets heeft gecontroleerd — nooit enkel wat iemand intypte.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Google / YouTube", "OAuth bij Google. ROUT krijgt een door Google bevestigd e-mailadres en, voor YouTube, het kanaal dat aan dat account hangt."],
                ["GitHub", "OAuth bij GitHub. Bewijst dat de gebruiker die GitHub-account beheert; e-mail telt alleen als GitHub ze als geverifieerd markeert."],
                ["GitLab", "OAuth/OIDC bij gitlab.com of een eigen GitLab-server. Zelfde regel: alleen bevestigde e-mail telt."],
                ["Bluesky / AT Protocol", "OAuth bij de eigen PDS van de gebruiker. ROUT bewaart de DID (vaste identiteit), niet enkel de handle. Een eigen domein kan via /.well-known/atproto-did."],
                ["Mastodon / fediverse", "OAuth bij de gekozen server. Omdat die meestal geen e-mail meegeeft, bevestigt de gebruiker zijn e-mail met een eenmalige code van 6 cijfers."],
                ["Persoon, bedrijf, influencer", "Handmatig nagekeken door ROUT. Namen komen uit een goedgekeurde lijst; de gebruiker kiest er precies één."],
              ].map(([t, d]) => (
                <div key={t} className="rounded-xl border border-border p-4">
                  <p className="font-medium">{t}</p>
                  <p className="mt-1 text-sm">{d}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="api" className="scroll-mt-24 space-y-4">
            <h2>API-overzicht</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {ENDPOINTS.map(([m, p, d]) => (
                    <tr key={p}><td className="p-3 font-mono text-xs">{m}</td><td className="p-3 font-mono text-xs">{p}</td><td className="p-3 text-muted-foreground">{d}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>QR- en link-API-sleutels beheer je in de <Link to="/console/api" className="text-foreground underline">console</Link>.</p>
          </section>

          <section id="errors" className="scroll-mt-24 space-y-4">
            <h2>Foutcodes en limieten</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {ERRORS.map(([c, s, d]) => (
                    <tr key={c}><td className="p-3 font-mono text-xs">{c}</td><td className="p-3 font-mono text-xs">{s}</td><td className="p-3 text-muted-foreground">{d}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Token-uitwisseling: {RATE_RULES.oauthToken.limit} per minuut per IP.</li>
              <li>Aanmelden en wachtwoordherstel: {RATE_RULES.authAttempt.limit} per minuut per IP.</li>
              <li>Nieuwe apps: {RATE_RULES.appCreate.limit} per uur per account.</li>
              <li>Sms-codes: {RATE_RULES.smsSendUser.limit} per uur per account, {RATE_RULES.smsSendPhone.limit} per nummer.</li>
            </ul>
          </section>
        </article>
      </div>
    </AppLayout>
  );
}
